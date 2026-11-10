import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen';
import { AppTabs } from '../navigation/AppTabs';
import { ModalCoordinator, useModal } from '../navigation/ModalCoordinator';
import { ModalHost } from '../navigation/ModalHost';
import { AuthProvider, useSession } from '../shared/auth/AuthProvider';
import type { SessionManager } from '../shared/auth/sessionManager';
import { QueryProvider } from '../shared/query';
import { colors } from '../shared/theme/tokens';
import { ConfirmProvider, LoadingState, Screen, ToastProvider } from '../shared/ui';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    notification: colors.primary,
  },
};

// `session` is only injected by tests; the app builds the real one (Keychain + API).
export default function StudySpaceApp({ session }: { session?: SessionManager }) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ToastProvider>
        <AuthProvider manager={session}>
          <QueryProvider>
            <ConfirmProvider>
              <ModalCoordinator>
                <Shell />
              </ModalCoordinator>
            </ConfirmProvider>
          </QueryProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const auth = useSession();
  const { open } = useModal();
  // Local "I pressed Explore" choice for guests. A real login is auth.status.
  const [entered, setEntered] = useState(false);

  // Explain once when a session ended on its own (expired, or the account was suspended).
  const explained = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (auth.endedReason && explained.current !== auth.endedReason) {
      explained.current = auth.endedReason;
      open({ name: 'session-ended', reason: auth.endedReason });
    } else if (!auth.endedReason) {
      explained.current = undefined;
    }
  }, [auth.endedReason, open]);

  // A deliberate sign-out (any path) goes back to Welcome. A session that ended on its own
  // (expired/suspended) keeps the user in the app as a guest, with the explanation above.
  const previous = useRef(auth.status);
  useEffect(() => {
    if (previous.current === 'authenticated' && auth.status === 'guest' && !auth.endedReason) {
      setEntered(false);
    }
    previous.current = auth.status;
  }, [auth.status, auth.endedReason]);

  if (auth.status === 'restoring') {
    return (
      <Screen>
        <LoadingState label="Đang mở StudySpace…" />
      </Screen>
    );
  }
  const inApp = entered || auth.status === 'authenticated';
  return (
    <NavigationContainer theme={theme}>
      {inApp ? (
        <AppTabs />
      ) : (
        <WelcomeScreen onContinue={() => setEntered(true)} />
      )}
      <ModalHost
        onWelcome={() => setEntered(false)}
        onContinue={() => setEntered(true)}
      />
    </NavigationContainer>
  );
}
