import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types, type HydratedDocument } from 'mongoose';
import { ApiException } from '../../common/api-error';
import type { IdentityContext } from '../../common/identity';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { FileAccessRegistry } from './file-access.registry';
import { FileAsset, FilePurpose, FileStatus } from './file.schema';
import { FileScanner, FileStorage } from './file-storage';
import { FileUploadInitDto } from './dto/files.dto';
import { FileReadyRef } from '../users/ports';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
const notFound = () => new ApiException(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp.');
const unsupported = () =>
  new ApiException(422, 'FILE_TYPE_UNSUPPORTED', 'Định dạng tệp không được hỗ trợ cho mục đích này.');
const fileConflict = (code: string, message: string) => new ApiException(409, code, message);

@Injectable()
export class FilesService extends FileReadyRef {
  constructor(
    @InjectModel(FileAsset.name) private readonly files: Model<FileAsset>,
    @Inject(FileStorage) private readonly storage: FileStorage,
    @Inject(FileScanner) private readonly scanner: FileScanner,
    private readonly access: FileAccessRegistry,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super();
  }

  private objectId(id: string) {
    if (!isValidObjectId(id)) throw notFound();
    return new Types.ObjectId(id);
  }

  private accepts(purpose: FilePurpose, contentType: string, sizeBytes: number) {
    if (purpose === FilePurpose.DOCUMENT) {
      return DOCUMENT_TYPES.has(contentType) && sizeBytes <= 20_000_000;
    }
    if ([FilePurpose.AVATAR, FilePurpose.PLACE_IMAGE, FilePurpose.REVIEW_IMAGE, FilePurpose.POST_IMAGE].includes(purpose)) {
      return IMAGE_TYPES.has(contentType) && sizeBytes <= 10_000_000;
    }
    return purpose === FilePurpose.EVIDENCE &&
      (IMAGE_TYPES.has(contentType) || DOCUMENT_TYPES.has(contentType)) &&
      sizeBytes <= 20_000_000;
  }

  async initiate(ownerId: string, dto: FileUploadInitDto) {
    if (!this.storage.isConfigured()) {
      throw new ApiException(503, 'FILE_STORAGE_NOT_CONFIGURED', 'Dịch vụ lưu trữ tệp chưa được cấu hình.');
    }
    if (!this.accepts(dto.purpose, dto.contentType, dto.sizeBytes)) throw unsupported();

    const now = new Date();
    const quotaStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const usage = await this.files.aggregate<{ total: number }>([
      {
        $match: {
          ownerId: this.objectId(ownerId),
          createdAt: { $gte: quotaStart },
          status: { $nin: [FileStatus.EXPIRED, FileStatus.REJECTED] },
        },
      },
      { $group: { _id: null, total: { $sum: '$sizeBytes' } } },
    ]);
    const quota = this.config.files?.dailyQuotaBytes ?? 100_000_000;
    if ((usage[0]?.total ?? 0) + dto.sizeBytes > quota) {
      throw new ApiException(429, 'UPLOAD_QUOTA_EXCEEDED', 'Đã vượt hạn mức tải tệp trong 24 giờ.');
    }

    const fileName = dto.fileName
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/[\\/]/g, '_')
      .trim();
    if (!fileName) throw unsupported();
    const expiresAt = new Date(now.getTime() + (this.config.files?.uploadUrlTtlSeconds ?? 600) * 1000);
    const file = await this.files.create({
      ownerId: this.objectId(ownerId),
      purpose: dto.purpose,
      fileName,
      storageKey: `${ownerId}/${randomUUID()}`,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256?.toLowerCase(),
      status: FileStatus.INITIATED,
      expiresAt,
    });
    const uploadUrl = await this.storage.createUploadUrl({
      key: file.storageKey,
      contentType: file.contentType,
      checksumSha256: file.checksumSha256,
      expiresInSeconds: this.config.files?.uploadUrlTtlSeconds ?? 600,
    });
    return {
      ...this.present(file),
      uploadUrl,
      uploadHeaders: {
        'Content-Type': file.contentType,
        ...(file.checksumSha256
          ? { 'x-amz-checksum-sha256': Buffer.from(file.checksumSha256, 'hex').toString('base64') }
          : {}),
      },
    };
  }

  async complete(ownerId: string, fileId: string) {
    const file = await this.files.findOne({
      _id: this.objectId(fileId),
      ownerId: this.objectId(ownerId),
    }).select('+storageKey');
    if (!file) throw notFound();
    if (file.status === FileStatus.READY) return this.present(file);
    if ([FileStatus.REJECTED, FileStatus.EXPIRED].includes(file.status)) {
      throw fileConflict('FILE_REJECTED', 'Tệp đã bị từ chối hoặc hết hạn.');
    }
    if (file.expiresAt && file.expiresAt <= new Date()) {
      file.status = FileStatus.EXPIRED;
      await file.save();
      throw fileConflict('FILE_NOT_FOUND', 'Thời hạn tải tệp đã hết.');
    }
    if (![FileStatus.INITIATED, FileStatus.UPLOADED, FileStatus.SCANNING].includes(file.status)) {
      throw fileConflict('FILE_SCAN_PENDING', 'Tệp chưa sẵn sàng để sử dụng.');
    }

    const head = await this.storage.head(file.storageKey);
    if (head.sizeBytes !== file.sizeBytes || head.contentType !== file.contentType) {
      file.status = FileStatus.REJECTED;
      file.rejectionReason = 'Metadata does not match the initialized upload.';
      await file.save();
      throw fileConflict('FILE_REJECTED', 'Thông tin tệp tải lên không khớp.');
    }
    const bytes = await this.storage.read(file.storageKey);
    if (bytes.byteLength !== file.sizeBytes || !this.matchesContentType(bytes, file.contentType)) {
      file.status = FileStatus.REJECTED;
      file.rejectionReason = 'Uploaded bytes do not match the declared content type or size.';
      await file.save();
      throw fileConflict('FILE_REJECTED', 'Nội dung tệp không khớp với định dạng đã khai báo.');
    }
    if (file.checksumSha256) {
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum !== file.checksumSha256) {
        file.status = FileStatus.REJECTED;
        file.rejectionReason = 'Checksum verification failed.';
        await file.save();
        throw fileConflict('FILE_REJECTED', 'Tệp tải lên không vượt qua bước kiểm tra toàn vẹn.');
      }
    }

    file.status = FileStatus.UPLOADED;
    await file.save();
    file.status = FileStatus.SCANNING;
    await file.save();
    const scan = await this.scanner.scan(bytes);
    file.scannedAt = new Date();
    if (scan === 'INFECTED') {
      file.status = FileStatus.REJECTED;
      file.rejectionReason = 'Malware detected by ClamAV.';
      await file.save();
      throw fileConflict('FILE_REJECTED', 'Tệp không vượt qua bước quét an toàn.');
    }
    file.status = FileStatus.READY;
    file.expiresAt = undefined;
    file.rejectionReason = undefined;
    await file.save();
    return this.present(file);
  }

  async status(ownerId: string, fileId: string) {
    const file = await this.files.findOne({
      _id: this.objectId(fileId),
      ownerId: this.objectId(ownerId),
    });
    if (!file) throw notFound();
    if (file.status === FileStatus.INITIATED && file.expiresAt && file.expiresAt <= new Date()) {
      await this.files.updateOne({ _id: file._id, status: FileStatus.INITIATED }, { $set: { status: FileStatus.EXPIRED } });
      file.status = FileStatus.EXPIRED;
    }
    return this.present(file);
  }

  async remove(ownerId: string, fileId: string) {
    const file = await this.files.findOne({
      _id: this.objectId(fileId),
      ownerId: this.objectId(ownerId),
    }).select('+storageKey');
    if (!file) throw notFound();
    if (file.status === FileStatus.READY) {
      throw fileConflict('FILE_IN_USE', 'Tệp đã sẵn sàng; không thể xóa qua API upload.');
    }
    await this.storage.delete(file.storageKey);
    await this.files.deleteOne({ _id: file._id });
  }

  async createAccess(fileId: string, actor?: IdentityContext) {
    const file = await this.files.findById(this.objectId(fileId)).select('+storageKey');
    if (!file || file.status !== FileStatus.READY) {
      throw fileConflict('FILE_NOT_READY', 'Tệp chưa sẵn sàng để truy cập.');
    }
    const viewerId = actor?.userId;
    const owner = viewerId !== undefined && String(file.ownerId) === viewerId;
    const descriptor = {
      id: String(file._id),
      ownerId: String(file.ownerId),
      purpose: file.purpose,
      status: file.status,
    };
    if (!owner && !(await this.access.allows(descriptor, actor))) {
      throw new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền truy cập tệp này.');
    }
    const expiresAt = new Date(Date.now() + (this.config.files?.accessUrlTtlSeconds ?? 300) * 1000);
    const url = await this.storage.createAccessUrl(
      file.storageKey,
      this.config.files?.accessUrlTtlSeconds ?? 300,
    );
    return {
      url,
      expiresAt,
      previewSupported: file.contentType === 'application/pdf' || file.contentType.startsWith('image/'),
    };
  }

  async assertReady(fileId: string, ownerId: string) {
    await this.assertReadyForPurpose(fileId, ownerId, FilePurpose.AVATAR);
  }

  async assertReadyForPurpose(fileId: string, ownerId: string, purpose: FilePurpose) {
    const file = await this.files.findOne({
      _id: this.objectId(fileId),
      ownerId: this.objectId(ownerId),
      purpose,
      status: FileStatus.READY,
    }).select('fileName contentType sizeBytes');
    if (!file) {
      throw fileConflict('FILE_NOT_READY', 'Tệp chưa sẵn sàng hoặc không đúng mục đích/người sở hữu.');
    }
    return {
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
    };
  }

  private matchesContentType(bytes: Buffer, contentType: string) {
    if (contentType === 'image/jpeg') {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (contentType === 'image/png') {
      return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (contentType === 'image/webp') {
      return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';
    }
    if (contentType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
    if (contentType.startsWith('application/vnd.openxmlformats-officedocument.')) {
      return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
        bytes[2] === 0x03 && bytes[3] === 0x04;
    }
    if (contentType === 'text/plain') {
      if (bytes.includes(0)) return false;
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private present(file: HydratedDocument<FileAsset>) {
    return {
      id: String(file._id),
      purpose: file.purpose,
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      status: file.status,
      expiresAt: file.expiresAt,
      createdAt: file.createdAt,
    };
  }
}
