import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';

type ToastItem = { id: number; message: string; tone: 'info' | 'error' };
type Push = (message: string, tone?: 'info' | 'error') => void;

const ToastContext = createContext<Push | undefined>(undefined);

/** `toast('Đã lưu.')` or `toast('Không lưu được.', 'error')`. */
export function useToast(): Push {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside ToastProvider');
  return push;
}

export function ToastProvider({ children, durationMs = 4000 }: PropsWithChildren<{ durationMs?: number }>) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  const push = useCallback<Push>(
    (message, tone = 'info') => {
      const id = next.current++;
      setItems(list => [...list.slice(-3), { id, message, tone }]);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setItems(list => list.filter(item => item.id !== id));
      }, durationMs);
      timers.current.add(timer);
    },
    [durationMs],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(item => (
          <div key={item.id} className={`toast${item.tone === 'error' ? ' toast-error' : ''}`} role={item.tone === 'error' ? 'alert' : 'status'}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
