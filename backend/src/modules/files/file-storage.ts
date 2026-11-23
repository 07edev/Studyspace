import type { FileHead } from './file.types';

export abstract class FileStorage {
  abstract isConfigured(): boolean;
  abstract createUploadUrl(input: {
    key: string;
    contentType: string;
    checksumSha256?: string;
    expiresInSeconds: number;
  }): Promise<string>;
  abstract head(key: string): Promise<FileHead>;
  abstract read(key: string): Promise<Buffer>;
  abstract createAccessUrl(key: string, expiresInSeconds: number): Promise<string>;
  abstract delete(key: string): Promise<void>;
}

export abstract class FileScanner {
  abstract scan(bytes: Buffer): Promise<'CLEAN' | 'INFECTED'>;
}
