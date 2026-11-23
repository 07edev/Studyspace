import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import type { SessionManager } from '../auth/sessionManager';
import type { FileUploader, PickedFile } from './types';

export type UploadPurpose = 'POST_IMAGE' | 'DOCUMENT' | 'EVIDENCE';

type UploadInit = {
  id: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
};

const MIME_TYPES = [
  types.images,
  types.pdf,
  types.docx,
  types.pptx,
  types.xlsx,
  types.plainText,
];

export function createFileUploader(
  session: Pick<SessionManager, 'request'>,
  purpose: UploadPurpose,
): FileUploader {
  return {
    async pick(): Promise<PickedFile | null> {
      try {
        const [file] = await pick({ type: MIME_TYPES, mode: 'import' });
        if (!file) return null;
        if (!file.hasRequestedType) {
          throw new Error('Tệp được chọn không đúng định dạng yêu cầu.');
        }
        if (!file.name || !file.type || file.size === null || file.size < 1) {
          throw new Error('Không đọc được tên, định dạng hoặc dung lượng tệp.');
        }
        return {
          uri: file.uri,
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        };
      } catch (error) {
        if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
          return null;
        }
        throw error;
      }
    },

    async upload(file: PickedFile, onProgress, signal) {
      const init = await session.request<UploadInit>('/files/uploads', {
        method: 'POST',
        body: {
          purpose,
          fileName: file.name,
          contentType: file.mimeType,
          sizeBytes: file.sizeBytes,
        },
        signal,
      });
      if (signal.aborted) throw new Error('Tải tệp đã bị hủy.');

      const localResponse = await fetch(file.uri, { signal });
      if (!localResponse.ok) throw new Error('Không thể đọc tệp trên thiết bị.');
      const blob = await localResponse.blob();
      if (signal.aborted) throw new Error('Tải tệp đã bị hủy.');
      if (blob.size !== file.sizeBytes) throw new Error('Dung lượng tệp trên thiết bị đã thay đổi.');
      await putFile(init, blob, onProgress, signal);

      await session.request(`/files/uploads/${init.id}/complete`, { method: 'POST', signal });
      return { fileId: init.id };
    },
  };
}

function putFile(
  init: UploadInit,
  blob: Blob,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.open('PUT', init.uploadUrl);
    for (const [name, value] of Object.entries(init.uploadHeaders)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Không thể tải tệp lên kho lưu trữ (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Kết nối tới kho lưu trữ tệp bị gián đoạn.'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error('Tải tệp đã bị hủy.'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    xhr.send(blob);
  });
}
