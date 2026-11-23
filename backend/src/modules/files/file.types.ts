import type { FilePurpose, FileStatus } from './file.schema';
import type { IdentityContext } from '../../common/identity';

export type FileHead = {
  sizeBytes?: number;
  contentType?: string;
  checksumSha256?: string;
};

export type FileAccessDescriptor = {
  id: string;
  ownerId: string;
  purpose: FilePurpose;
  status: FileStatus;
};

export type FileAccessCheck = (
  file: FileAccessDescriptor,
  actor?: IdentityContext,
) => Promise<boolean>;
