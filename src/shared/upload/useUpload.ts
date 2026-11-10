import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { FileUploader, PickedFile, UploadRules } from './types';

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: PickedFile; progress: number }
  | { phase: 'ready'; file: PickedFile; fileId: string }
  | { phase: 'failed'; file: PickedFile; message: string };

const matches = (type: string, rule: string) =>
  rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule;

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Returns a Vietnamese message when the file breaks the rules; the file never reaches the server then. */
export function fileProblem(file: PickedFile, rules: UploadRules): string | undefined {
  if (!rules.mimeTypes.some(rule => matches(file.mimeType, rule))) {
    return 'Định dạng tệp này không được hỗ trợ.';
  }
  if (file.sizeBytes > rules.maxBytes) {
    return `Tệp quá lớn. Dung lượng tối đa là ${mb(rules.maxBytes)}.`;
  }
  return undefined;
}

/**
 * State machine behind UploadPicker: idle -> uploading -> ready | failed. One upload at a time;
 * choosing again, cancelling or leaving the screen aborts the one in flight.
 */
export function useUpload(uploader: FileUploader, rules: UploadRules) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);

  const start = useCallback(
    async (file: PickedFile) => {
      const problem = fileProblem(file, rules);
      if (problem) {
        setState({ phase: 'failed', file, message: problem });
        return;
      }
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setState({ phase: 'uploading', file, progress: 0 });
      try {
        const { fileId } = await uploader.upload(
          file,
          fraction => {
            if (mounted.current && !controller.signal.aborted) {
              setState({ phase: 'uploading', file, progress: Math.min(1, Math.max(0, fraction)) });
            }
          },
          controller.signal,
        );
        if (mounted.current && !controller.signal.aborted) {
          setState({ phase: 'ready', file, fileId });
        }
      } catch (caught) {
        if (mounted.current && !controller.signal.aborted) {
          setState({
            phase: 'failed',
            file,
            message:
              caught instanceof ApiError ? caught.message : 'Tải lên chưa thành công. Vui lòng thử lại.',
          });
        }
      }
    },
    [uploader, rules],
  );

  const choose = useCallback(async () => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    try {
      const file = await uploader.pick();
      if (file && mounted.current) {
        // Do not wait for the upload itself: the picker is free again as soon as it has started.
        start(file);
      }
    } catch {
      if (mounted.current) {
        setState(prev =>
          prev.phase === 'idle' ? { phase: 'idle' } : prev,
        );
      }
    } finally {
      busy.current = false;
    }
  }, [uploader, start]);

  const retry = useCallback(() => {
    if (state.phase === 'failed') {
      start(state.file);
    }
  }, [state, start]);

  const clear = useCallback(() => {
    abort.current?.abort();
    setState({ phase: 'idle' });
  }, []);

  return { state, choose, retry, clear };
}
