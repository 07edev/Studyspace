import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types, type HydratedDocument } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { Role } from '../../common/enums';
import type { IdentityContext } from '../../common/identity';
import { escapeRegex, pageParams, toPage } from '../../common/utils/page';
import { AuditService } from '../audit/audit.service';
import { FileAccessRegistry } from '../files/file-access.registry';
import { FilePurpose } from '../files/file.schema';
import { FilesService } from '../files/files.service';
import { OutboxService } from '../outbox/outbox.service';
import { StatsRegistry } from '../stats/stats.registry';
import { TaxonomyRef } from '../users/ports';
import { UsersService } from '../users/users.service';
import {
  Document,
  DocumentFormat,
  DocumentStatus,
  DocumentVisibility,
} from './document.schema';
import { DocumentModerationDto, DocumentWriteDto, DocumentsQuery } from './dto/documents.dto';

type DocumentRecord = Document & { _id: Types.ObjectId };

const notFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy tài liệu.');
const forbidden = () => new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền truy cập tài liệu này.');
const formatByMime: Record<string, DocumentFormat> = {
  'application/pdf': DocumentFormat.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentFormat.DOCX,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': DocumentFormat.PPTX,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocumentFormat.XLSX,
  'text/plain': DocumentFormat.TXT,
};

@Injectable()
export class DocumentsService implements OnModuleInit {
  constructor(
    @InjectModel(Document.name) private readonly documents: Model<Document>,
    private readonly files: FilesService,
    private readonly taxonomy: TaxonomyRef,
    private readonly users: UsersService,
    private readonly fileAccess: FileAccessRegistry,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly stats: StatsRegistry,
  ) {}

  onModuleInit() {
    this.fileAccess.register(
      FilePurpose.DOCUMENT,
      'documents',
      (file, actor) => this.canAccessFile(file.id, actor),
    );
    this.stats.register({
      name: 'documents',
      overview: async () => {
        const [totalDocuments, pendingDocuments] = await Promise.all([
          this.documents.countDocuments({ status: DocumentStatus.APPROVED }),
          this.documents.countDocuments({ status: DocumentStatus.PENDING }),
        ]);
        return { totalDocuments, pendingDocuments };
      },
      daily: async window => {
        const rows = await this.documents.aggregate<{ date: string; count: number }>([
          { $match: { createdAt: { $gte: window.from, $lt: window.to } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' },
              },
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, date: '$_id', count: 1 } },
          { $sort: { date: 1 } },
        ]);
        return { documents: rows };
      },
    });
  }

  async listPublic(query: DocumentsQuery) {
    const filter = this.publicFilter(query);
    return this.list(filter, query);
  }

  async reportableOwner(documentId: string) {
    const document = await this.documents.findOne({
      _id: this.objectId(documentId),
      status: DocumentStatus.APPROVED,
      visibility: DocumentVisibility.PUBLIC,
    }).select('authorId');
    if (!document) throw notFound();
    return String(document.authorId);
  }

  async assertPublicAttachable(documentId: string) {
    const document = await this.documents.findOne({
      _id: this.objectId(documentId),
      status: DocumentStatus.APPROVED,
      visibility: DocumentVisibility.PUBLIC,
    }).select('_id');
    if (!document) {
      throw new ApiException(422, 'DOCUMENT_NOT_AVAILABLE', 'Chỉ có thể đính kèm tài liệu công khai đã được duyệt.');
    }
  }

  async moderationVersion(documentId: string) {
    const document = await this.documents.findById(this.objectId(documentId)).select('version');
    if (!document) throw notFound();
    return document.version ?? 1;
  }

  async detail(documentId: string, actor?: IdentityContext) {
    const document = await this.documents.findById(this.objectId(documentId));
    if (!document || document.status === DocumentStatus.DELETED) throw notFound();
    const owner = actor?.userId === String(document.authorId);
    const publicDocument = document.status === DocumentStatus.APPROVED &&
      document.visibility === DocumentVisibility.PUBLIC;
    if (!owner && !publicDocument) throw forbidden();
    if (publicDocument) {
      await this.documents.updateOne({ _id: document._id }, { $inc: { viewsCount: 1 } });
      document.viewsCount += 1;
    }
    return this.present(document);
  }

  async create(authorId: string, dto: DocumentWriteDto) {
    if (dto.shareRightsConfirmed !== true) {
      throw new ApiException(422, 'COPYRIGHT_CONFIRMATION_REQUIRED', 'Bạn cần xác nhận quyền chia sẻ tài liệu.');
    }
    if (dto.subjectId || dto.majorId) {
      await this.taxonomy.assertValid({ majorId: dto.majorId });
    }
    const file = await this.files.assertReadyForPurpose(dto.fileId, authorId, FilePurpose.DOCUMENT);
    const format = formatByMime[file.contentType];
    if (!format) throw new ApiException(422, 'FILE_TYPE_UNSUPPORTED', 'Định dạng tài liệu không được hỗ trợ.');
    const document = await this.documents.create({
      authorId: this.objectId(authorId),
      fileId: this.objectId(dto.fileId),
      title: dto.title,
      description: dto.description,
      subjectId: dto.subjectId ? this.objectId(dto.subjectId) : undefined,
      majorId: dto.majorId ? this.objectId(dto.majorId) : undefined,
      category: dto.category,
      fileName: file.fileName,
      format,
      sizeBytes: file.sizeBytes,
      visibility: dto.visibility,
      shareRightsConfirmed: true,
      status: DocumentStatus.PENDING,
      version: 1,
    });
    return this.present(document);
  }

  async mine(authorId: string, query: DocumentsQuery) {
    const filter: Record<string, unknown> = {
      authorId: this.objectId(authorId),
      status: { $ne: DocumentStatus.DELETED },
    };
    if (query.status) filter.status = query.status;
    return this.list(filter, query);
  }

  userContentCount(authorId: string) {
    return this.documents.countDocuments({
      authorId: this.objectId(authorId),
      status: { $ne: DocumentStatus.DELETED },
    });
  }

  async previewAccess(documentId: string, actor?: IdentityContext) {
    const document = await this.accessible(documentId, actor);
    if (document.format !== DocumentFormat.PDF) {
      throw new ApiException(415, 'PREVIEW_UNSUPPORTED', 'Chỉ hỗ trợ xem trước PDF.');
    }
    const access = await this.files.createAccess(String(document.fileId), actor);
    if (!access.previewSupported) {
      throw new ApiException(415, 'PREVIEW_UNSUPPORTED', 'Không hỗ trợ xem trước định dạng này.');
    }
    return access;
  }

  async downloadAccess(documentId: string, actor?: IdentityContext) {
    const document = await this.accessible(documentId, actor);
    const access = await this.files.createAccess(String(document.fileId), actor);
    await this.documents.updateOne({ _id: document._id }, { $inc: { downloadsCount: 1 } });
    return access;
  }

  async listAdmin(query: DocumentsQuery) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.subjectId) filter.subjectId = this.objectId(query.subjectId);
    if (query.majorId) filter.majorId = this.objectId(query.majorId);
    if (query.format) filter.format = query.format;
    if (query.q?.trim()) {
      const term = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ title: term }, { description: term }, { fileName: term }];
    }
    return this.list(filter, query);
  }

  async adminDetail(documentId: string) {
    const document = await this.documents.findById(this.objectId(documentId));
    if (!document) throw notFound();
    return this.present(document);
  }

  async adminPreviewAccess(documentId: string, actor: IdentityContext) {
    const document = await this.adminDetailRecord(documentId);
    if (document.format !== DocumentFormat.PDF) {
      throw new ApiException(415, 'PREVIEW_UNSUPPORTED', 'Chỉ hỗ trợ xem trước PDF.');
    }
    return this.files.createAccess(String(document.fileId), actor);
  }

  async moderate(
    actor: IdentityContext,
    documentId: string,
    dto: DocumentModerationDto,
    requestId: string,
  ) {
    const id = this.objectId(documentId);
    const current = await this.documents.findById(id);
    if (!current) throw notFound();
    const currentVersion = current.version ?? 1;
    if (currentVersion !== dto.expectedVersion) {
      throw new ApiException(409, 'VERSION_CONFLICT', 'Tài liệu đã được cập nhật bởi người khác.');
    }
    const allowed = dto.action === 'HIDE'
      ? current.status === DocumentStatus.APPROVED
      : current.status === DocumentStatus.PENDING;
    if (!allowed) {
      throw new ApiException(409, 'INVALID_STATE_TRANSITION', 'Trạng thái tài liệu không cho phép thao tác này.');
    }

    const nextStatus = dto.action === 'APPROVE'
      ? DocumentStatus.APPROVED
      : dto.action === 'REJECT'
        ? DocumentStatus.REJECTED
        : DocumentStatus.HIDDEN;
    const updated = await this.documents.findOneAndUpdate(
      {
        _id: id,
        status: current.status,
        ...(dto.expectedVersion === 1
          ? { $or: [{ version: 1 }, { version: { $exists: false } }] }
          : { version: dto.expectedVersion }),
      },
      {
        $set: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedBy: this.objectId(actor.userId),
          rejectionReason: dto.action === 'APPROVE' ? undefined : dto.reason,
          version: dto.expectedVersion + 1,
        },
      },
      { returnDocument: 'after' },
    );
    if (!updated) {
      throw new ApiException(409, 'VERSION_CONFLICT', 'Tài liệu đã được cập nhật bởi người khác.');
    }
    const action = `DOCUMENT_${dto.action === 'HIDE' ? 'HIDDEN' : dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}`;
    await this.audit.record({
      actorId: actor.userId,
      actorType: 'ADMIN',
      action,
      resourceType: 'DOCUMENT',
      resourceId: String(updated._id),
      requestId,
      before: { status: current.status, version: currentVersion },
      after: { status: updated.status, version: updated.version, reason: dto.reason },
    });
    await this.outbox.enqueue({
      eventType: 'DOCUMENT_MODERATION_RESULT',
      aggregateType: 'DOCUMENT',
      aggregateId: String(updated._id),
      payload: {
        recipientId: String(updated.authorId),
        documentId: String(updated._id),
        action: dto.action,
        reason: dto.reason ?? '',
      },
    });
    return this.present(updated);
  }

  async canAccessFile(fileId: string, actor?: IdentityContext) {
    if (!isValidObjectId(fileId)) return false;
    const document = await this.documents.findOne({
      fileId: this.objectId(fileId),
      status: { $ne: DocumentStatus.DELETED },
    }).select('authorId status visibility');
    if (!document) return false;
    if (actor?.userId === String(document.authorId)) return true;
    const canReadAsAdmin = actor?.role === Role.SUPER_ADMIN || actor?.permissions.some(
      permission => permission.module === 'DOCUMENTS' && permission.actions.includes('READ'),
    );
    return Boolean(canReadAsAdmin) ||
      (document.status === DocumentStatus.APPROVED && document.visibility === DocumentVisibility.PUBLIC);
  }

  private publicFilter(query: DocumentsQuery) {
    const filter: Record<string, unknown> = {
      status: DocumentStatus.APPROVED,
      visibility: DocumentVisibility.PUBLIC,
    };
    if (query.subjectId) filter.subjectId = this.objectId(query.subjectId);
    if (query.majorId) filter.majorId = this.objectId(query.majorId);
    if (query.category) filter.category = query.category;
    if (query.format) filter.format = query.format;
    if (query.q?.trim()) {
      const term = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [{ title: term }, { description: term }, { category: term }];
    }
    return filter;
  }

  private async accessible(documentId: string, actor?: IdentityContext) {
    const document = await this.documents.findById(this.objectId(documentId));
    if (!document || document.status === DocumentStatus.DELETED) throw notFound();
    const owner = actor?.userId === String(document.authorId);
    const publicDocument = document.status === DocumentStatus.APPROVED &&
      document.visibility === DocumentVisibility.PUBLIC;
    if (!owner && !publicDocument) throw forbidden();
    return document;
  }

  private async adminDetailRecord(documentId: string) {
    const document = await this.documents.findById(this.objectId(documentId));
    if (!document) throw notFound();
    return document;
  }

  private async list(filter: Record<string, unknown>, query: DocumentsQuery) {
    const { page, limit, skip } = pageParams(query);
    const sort: Record<string, 1 | -1> = query.sort === 'POPULAR'
      ? { downloadsCount: -1, createdAt: -1, _id: -1 }
      : { createdAt: -1, _id: -1 };
    const [rows, total] = await Promise.all([
      this.documents.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.documents.countDocuments(filter),
    ]);
    const items = await Promise.all(rows.map(row => this.present(row)));
    return toPage(items, total, page, limit);
  }

  private async present(document: HydratedDocument<Document> | DocumentRecord) {
    let author: Record<string, unknown>;
    try {
      author = await this.users.publicProfile(String(document.authorId));
    } catch (error) {
      if (!(error instanceof ApiException) || error.code !== 'NOT_FOUND') throw error;
      author = { id: String(document.authorId), displayName: 'Người dùng StudySpace' };
    }
    return {
      id: String(document._id),
      title: document.title,
      description: document.description,
      subjectId: document.subjectId ? String(document.subjectId) : undefined,
      majorId: document.majorId ? String(document.majorId) : undefined,
      category: document.category,
      fileId: String(document.fileId),
      fileName: document.fileName,
      format: document.format,
      sizeBytes: document.sizeBytes,
      visibility: document.visibility,
      status: document.status,
      author,
      viewsCount: document.viewsCount,
      downloadsCount: document.downloadsCount,
      reviewedAt: document.reviewedAt,
      reviewedBy: document.reviewedBy ? String(document.reviewedBy) : undefined,
      rejectionReason: document.rejectionReason,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private objectId(id: string) {
    if (!isValidObjectId(id)) throw notFound();
    return new Types.ObjectId(id);
  }
}
