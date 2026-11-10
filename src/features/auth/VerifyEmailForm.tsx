import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, TextField, useToast } from '../../shared/ui';
import { authApi } from './authApi';
import { useCountdown, useDirtyGuard, useSubmit } from './formHooks';

const RESEND_SECONDS = 60;

// U02 - Xac minh email bang ma OTP 6 so
export function VerifyEmailForm({
  email,
  resendIn = 0,
  onAuthenticated,
}: {
  email: string;
  resendIn?: number;
  onAuthenticated: () => void;
}) {
  const session = useSessionManager();
  const api = useMemo(() => authApi(session), [session]);
  const { open, setDirty } = useModal();
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [local, setLocal] = useState<string>();
  const submit = useSubmit();
  const resend = useSubmit();
  const cooldown = useCountdown(resendIn);
  useDirtyGuard(otp !== '');

  const onVerify = async () => {
    if (!/^[0-9]{6}$/.test(otp)) {
      setLocal('Mã gồm 6 chữ số.');
      return;
    }
    setLocal(undefined);
    const done = await submit.run(async () => {
      await session.startSession(await api.verifyEmail({ email, otp }));
      return true;
    });
    if (done) {
      setDirty(false);
      onAuthenticated();
      // New account: offer to complete the profile (U05). It can be skipped.
      open({ name: 'profile-edit', mode: 'complete' });
      toast('Email đã được xác minh. Chào mừng bạn đến StudySpace!');
    }
  };

  const onResend = async () => {
    const sent = await resend.run(
      () => api.resendEmailOtp(email),
      error => error.retryAfterSeconds && cooldown.start(error.retryAfterSeconds),
    );
    if (sent) {
      cooldown.start(RESEND_SECONDS);
      toast('Nếu email hợp lệ, mã mới đã được gửi.');
    }
  };

  return (
    <View style={styles.form}>
      <AppText muted>
        Chúng tôi đã gửi mã gồm 6 chữ số tới <AppText style={styles.bold}>{email}</AppText>. Mã có hiệu lực trong 5 phút.
      </AppText>
      <TextField
        label="Mã xác minh"
        value={otp}
        onChangeText={value => setOtp(value.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={onVerify}
        error={local ?? submit.fields.otp}
      />
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button title="Xác minh" onPress={onVerify} loading={submit.pending} />
      {resend.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {resend.message}
        </AppText>
      )}
      <Button
        variant="ghost"
        title={cooldown.left > 0 ? `Gửi lại mã sau ${cooldown.left}s` : 'Gửi lại mã'}
        disabled={cooldown.left > 0}
        loading={resend.pending}
        onPress={onResend}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16 },
  bold: { fontWeight: '700' },
  error: { color: colors.error },
});
