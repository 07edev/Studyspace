import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { useToast } from '../../shared/ui';

/**
 * Loads a settings object once when the sheet opens, then saves each change right away.
 * A toggle is shown at once and put back (with the server's message) if saving fails.
 * Only one save runs at a time, so two quick taps can never overwrite each other.
 */
export function useRemoteSettings<T extends object>(
  load: () => Promise<T>,
  save: (patch: Partial<T>) => Promise<T>,
) {
  const toast = useToast();
  const [value, setValue] = useState<T>();
  const [loadError, setLoadError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(async () => {
    setLoadError(undefined);
    try {
      const next = await loader.current();
      if (mounted.current) {
        setValue(next);
      }
    } catch (caught) {
      if (mounted.current) {
        setLoadError(
          caught instanceof ApiError ? caught.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.',
        );
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const update = async (patch: Partial<T>) => {
    if (busy.current || !value) {
      return;
    }
    busy.current = true;
    const previous = value;
    setValue({ ...value, ...patch });
    setSaving(true);
    try {
      const saved = await save(patch);
      if (mounted.current) {
        setValue(saved);
      }
    } catch (caught) {
      if (mounted.current) {
        setValue(previous);
      }
      toast(caught instanceof ApiError ? caught.message : 'Chưa lưu được. Vui lòng thử lại.');
    } finally {
      busy.current = false;
      if (mounted.current) {
        setSaving(false);
      }
    }
  };

  return { value, loadError, saving, reload, update };
}
