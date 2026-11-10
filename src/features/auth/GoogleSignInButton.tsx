import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, useToast } from '../../shared/ui';
import { authApi } from './authApi';
import { useSubmit } from './formHooks';
import { requestGoogleIdToken } from './googleSignIn';

// U03 - "Tiep tuc voi Google": the same session result as email login.
export function GoogleSignInButton({ onAuthenticated }: { onAuthenticated: () => void }) {
  const session = useSessionManager();
  const api = useMemo(() => authApi(session), [session]);
  const { close, setDirty } = useModal();
  const toast = useToast();
  const submit = useSubmit();

  const onPress = async () => {
    const done = await submit.run(async () => {
      const idToken = await requestGoogleIdToken();
      if (!idToken) {
        return false; // closed the account picker: nothing to say
      }
      await session.startSession(await api.loginWithGoogle(idToken));
      return true;
    });
    if (done) {
      setDirty(false);
      close();
      onAuthenticated();
      toast('Chào mừng bạn đến với StudySpace!');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText variant="caption" muted>
          hoặc
        </AppText>
        <View style={styles.line} />
      </View>
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button
        variant="secondary"
        title="Tiếp tục với Google"
        onPress={onPress}
        loading={submit.pending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  error: { color: colors.error },
});
