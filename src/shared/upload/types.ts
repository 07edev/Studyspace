// Contract between the shared upload UI (TV1) and the file service (TV3).
//
// The shared uploader implements init -> signed PUT -> scan completion, then UploadPicker exposes
// a fileId only after the backend confirms READY.

export type PickedFile = {
  uri: string; // local file:// or content:// uri from the OS picker
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export type UploadRules = {
  maxBytes: number;
  // Exact types ('image/png') or families ('image/*').
  mimeTypes: string[];
};

export interface FileUploader {
  /**
   * Opens the OS gallery/file picker. Returns null when the user closes it without choosing.
   * Must NOT call the API: nothing is uploaded until the user has actually picked a file.
   */
  pick(): Promise<PickedFile | null>;
  /**
   * Uploads and resolves ONLY when the server reports the file READY. Report 0..1 through onProgress,
   * and stop quietly when `signal` aborts. The returned fileId is what other APIs accept
   * (e.g. ProfilePatch.avatarFileId).
   */
  upload(
    file: PickedFile,
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ): Promise<{ fileId: string }>;
}

export const IMAGE_RULES: UploadRules = { maxBytes: 10 * 1024 * 1024, mimeTypes: ['image/*'] };
export const POST_IMAGE_RULES: UploadRules = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};
export const DOCUMENT_RULES: UploadRules = {
  maxBytes: 20 * 1024 * 1024,
  mimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
};
export const EVIDENCE_RULES: UploadRules = {
  maxBytes: 20 * 1024 * 1024,
  mimeTypes: [...POST_IMAGE_RULES.mimeTypes, ...DOCUMENT_RULES.mimeTypes],
};
