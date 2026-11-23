import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiException } from '../../common/api-error';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { Inject } from '@nestjs/common';
import { FileStorage } from './file-storage';

const isNotFound = (error: unknown) =>
  typeof error === 'object' && error !== null && (
    ('name' in error && error.name === 'NotFound') ||
    ('$metadata' in error && typeof error.$metadata === 'object' &&
      error.$metadata !== null && 'httpStatusCode' in error.$metadata &&
      error.$metadata.httpStatusCode === 404)
  );

const sha256Base64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64');

@Injectable()
export class S3FileStorage extends FileStorage {
  private readonly client: S3Client;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    const files = config.files;
    this.client = new S3Client({
      region: files?.s3Region ?? 'us-east-1',
      endpoint: files?.s3Endpoint,
      forcePathStyle: files?.s3ForcePathStyle,
      credentials: files?.s3AccessKeyId && files.s3SecretAccessKey
        ? { accessKeyId: files.s3AccessKeyId, secretAccessKey: files.s3SecretAccessKey }
        : undefined,
    });
  }

  isConfigured() {
    return Boolean(this.config.files?.s3Bucket);
  }

  private bucket() {
    const bucket = this.config.files?.s3Bucket;
    if (!bucket) {
      throw new ApiException(503, 'FILE_STORAGE_NOT_CONFIGURED', 'Dịch vụ lưu trữ tệp chưa được cấu hình.');
    }
    return bucket;
  }

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    checksumSha256?: string;
    expiresInSeconds: number;
  }) {
    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: input.key,
      ContentType: input.contentType,
      ...(input.checksumSha256 ? { ChecksumSHA256: sha256Base64(input.checksumSha256) } : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
  }

  async head(key: string) {
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        ChecksumMode: 'ENABLED',
      }));
      return {
        sizeBytes: result.ContentLength,
        contentType: result.ContentType,
        checksumSha256: result.ChecksumSHA256,
      };
    } catch (error) {
      if (isNotFound(error)) {
        throw new ApiException(409, 'FILE_NOT_UPLOADED', 'Tệp chưa được tải lên storage.');
      }
      throw error;
    }
  }

  async read(key: string) {
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket(),
      Key: key,
      ChecksumMode: 'ENABLED',
    }));
    if (!result.Body) {
      throw new ApiException(503, 'FILE_STORAGE_READ_FAILED', 'Không thể đọc nội dung tệp để kiểm tra.');
    }
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async createAccessUrl(key: string, expiresInSeconds: number) {
    const command = new GetObjectCommand({ Bucket: this.bucket(), Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
  }
}
