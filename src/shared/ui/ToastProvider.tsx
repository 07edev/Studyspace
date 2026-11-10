import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';

const ToastContext = createContext<((message: string) => void) | null>(null);
export function ToastProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const show = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(undefined), 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${message}. Đóng thông báo`}
          onPress={() => setMessage(undefined)}
          style={[styles.toast, { bottom: insets.bottom + 84 }]}
        >
          <AppText accessibilityLiveRegion="polite" style={styles.text}>
            {message}
          </AppText>
        </Pressable>
      )}
    </ToastContext.Provider>
  );
}
export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return value;
}
const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.ink,
    elevation: 8,
  },
  text: { color: colors.surface, textAlign: 'center' },
});
