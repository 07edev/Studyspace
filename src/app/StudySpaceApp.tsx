import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen';
import { AppTabs } from '../navigation/AppTabs';
import { ModalCoordinator } from '../navigation/ModalCoordinator';
import { ModalHost } from '../navigation/ModalHost';
import { colors } from '../shared/theme/tokens';
import { ToastProvider } from '../shared/ui';

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

export default function StudySpaceApp() {
  // Local navigation choice only. Never treated as an authenticated session.
  const [entered, setEntered] = useState(false);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ToastProvider>
        <ModalCoordinator>
          <NavigationContainer theme={theme}>
            {entered ? (
              <AppTabs />
            ) : (
              <WelcomeScreen onContinue={() => setEntered(true)} />
            )}
            <ModalHost
              onWelcome={() => setEntered(false)}
              onContinue={() => setEntered(true)}
            />
          </NavigationContainer>
        </ModalCoordinator>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
