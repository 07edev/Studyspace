import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button for irreversible actions (delete, sign out everywhere).
  destructive?: boolean;
};

/** The dialog body. ModalHost draws it; screens do not render it themselves. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Đồng ý',
  cancelLabel = 'Hủy',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  return (
    <View accessibilityViewIsModal style={styles.card}>
      <AppText variant="heading">{title}</AppText>
      {message ? <AppText muted>{message}</AppText> : null}
      <Button
        title={confirmLabel}
        variant={destructive ? 'danger' : 'primary'}
        onPress={onConfirm}
      />
      <Button title={cancelLabel} variant="ghost" onPress={onCancel} />
    </View>
  );
}

type Request = ConfirmOptions & { id: number };
type ConfirmContextValue = {
  request: Request | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  answer: (accepted: boolean) => void;
};
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const counter = useRef(0);

  const answer = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setRequest(null);
  }, []);

  const ask = useCallback((options: ConfirmOptions) => {
    // Only one question at a time: a newer one cancels the older (answered "no").
    resolver.current?.(false);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      counter.current += 1;
      setRequest({ ...options, id: counter.current });
    });
  }, []);

  const value = useMemo(() => ({ request, ask, answer }), [request, ask, answer]);
  return <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>;
}

function useConfirmContext() {
  const value = useContext(ConfirmContext);
  if (!value) {
    throw new Error('useConfirm must be used inside ConfirmProvider');
  }
  return value;
}

/**
 * `const confirm = useConfirm(); if (await confirm({ title: 'Xóa bài viết?', destructive: true })) {...}`
 * Resolves true when the user confirms, false on cancel / back / tapping outside.
 * Works on any screen and on top of any modal.
 */
export function useConfirm() {
  return useConfirmContext().ask;
}

/** For ModalHost only: the question to draw and the way to answer it. */
export function useConfirmHost() {
  const { request, answer } = useConfirmContext();
  return { request, answer };
}

const styles = StyleSheet.create({
  card: { padding: 24, gap: 18 },
});
