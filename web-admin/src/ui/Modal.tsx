import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, type PropsWithChildren } from 'react';
import { useConfirm } from './Confirm';

// Sizes follow the spec: C = confirmation / short form, L = sheet, F = full screen.
export type ModalSize = 'C' | 'L' | 'F';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Dialog with focus trap, Escape / backdrop to close and an optional "unsaved changes" guard.
 * Rendered only while open; the parent owns the open state.
 */
export function Modal({
  title, size = 'C', onClose, dirty = false, children, confirmOverlay = false,
}: PropsWithChildren<{
  title: string;
  size?: ModalSize;
  onClose: () => void;
  // When true, closing by Escape / backdrop / X first asks "Rời khỏi form?".
  dirty?: boolean;
  confirmOverlay?: boolean;
}>) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();
  // Keep the latest values readable from the key handler without re-subscribing every render.
  const live = useRef({ dirty, onClose, confirm });
  live.current = { dirty, onClose, confirm };

  const requestClose = useCallback(async () => {
    const { dirty: isDirty, onClose: close, confirm: ask } = live.current;
    if (!isDirty || (await ask({ title: 'Rời khỏi form?', message: 'Thay đổi chưa lưu sẽ bị mất.', confirmLabel: 'Rời đi', destructive: true }))) {
      close();
    }
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus],input,select,textarea') ?? panel.current;
    first?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      void requestClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  };

  return (
    <div
      className={`overlay${confirmOverlay ? ' overlay-confirm' : ''}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) void requestClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`modal modal-${size}`}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={() => void requestClose()}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
