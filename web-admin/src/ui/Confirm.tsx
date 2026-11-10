import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type PropsWithChildren } from 'react';
import { Button } from './controls';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button; focus starts on Cancel so Enter never destroys by accident.
  destructive?: boolean;
};
type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | undefined>(undefined);

/** `if (await confirm({ title: 'Xóa?', destructive: true })) ...` — true = agreed, false = cancelled. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ask;
}

type Pending = { options: ConfirmOptions; resolve: (answer: boolean) => void };

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [pending, setPending] = useState<Pending>();
  const current = useRef<Pending | undefined>(undefined);
  current.current = pending;

  const ask = useCallback<Ask>(
    options =>
      new Promise<boolean>(resolve => {
        // A new question cancels one that is still open, so no promise is left hanging.
        current.current?.resolve(false);
        setPending({ options, resolve });
      }),
    [],
  );

  const answer = (value: boolean) => {
    pending?.resolve(value);
    setPending(undefined);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && <ConfirmDialog options={pending.options} onAnswer={answer} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (value: boolean) => void }) {
  const titleId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation(); // do not also close the modal underneath
      onAnswer(false);
    } else if (event.key === 'Tab') {
      // Two buttons only: keep focus inside by hand.
      event.preventDefault();
      (document.activeElement === cancel.current ? confirm : cancel).current?.focus();
    }
  };

  return (
    <div
      className="overlay overlay-confirm"
      onMouseDown={event => event.target === event.currentTarget && onAnswer(false)}
      onKeyDown={onKeyDown}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="modal modal-C">
        <div className="modal-head"><h2 id={titleId}>{options.title}</h2></div>
        <div className="modal-body">
          {options.message && <p>{options.message}</p>}
          <div className="modal-actions">
            <button ref={cancel} type="button" className="btn btn-secondary" onClick={() => onAnswer(false)}>
              {options.cancelLabel ?? 'Hủy'}
            </button>
            <Button ref={confirm} variant={options.destructive ? 'danger' : 'primary'} onClick={() => onAnswer(true)}>
              {options.confirmLabel ?? 'Đồng ý'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
