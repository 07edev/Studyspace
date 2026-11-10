import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, TextField, useToast } from '../../shared/ui';
import { authApi } from './authApi';
import { EMAIL_PATTERN, useCountdown, useDirtyGuard, useSubmit } from './formHooks';
import { PASSWORD_HINT, passwordIssue } from './RegisterForm';

type Step = 'email' | 'otp' | 'password';
const RESEND_SECONDS = 60;

// U04 - Quen mat khau: email -> ma OTP -> mat khau moi, trong mot modal.
export function ForgotPasswordFlow() {
  const session = useSessionManager();
  const api = useMemo(() => authApi(session), [session]);
  const { open, setDirty } = useModal();
  const toast = useToast();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = useSubmit();
  const cooldown = useCountdown(0);
  useDirtyGuard(email !== '' || otp !== '' || password !== '' || confirm !== '');

  const sendCode = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setLocal({ email: 'Email không hợp lệ.' });
      return;
    }
    setLocal({});
    const sent = await submit.run(() => api.forgotPassword(email.trim()));
    if (sent) {
      cooldown.start(RESEND_SECONDS);
      setStep('otp');
    }
  };

  const verifyCode = async () => {
    if (!/^[0-9]{6}$/.test(otp)) {
      setLocal({ otp: 'Mã gồm 6 chữ số.' });
      return;
    }
    setLocal({});
    const grant = await submit.run(() => api.verifyResetOtp({ email: email.trim(), otp }));
    if (grant) {
      setResetToken(grant.resetToken);
      setStep('password');
    }
  };

  const reset = async () => {
    const errors: Record<string, string> = {};
    const issue = passwordIssue(password);
    if (issue) {
      errors.newPassword = issue;
    }
    if (confirm !== password) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const done = await submit.run(() =>
      api.resetPassword({ resetToken, newPassword: password, confirmPassword: confirm }),
    );
    if (done) {
      setDirty(false);
      open({ name: 'auth', mode: 'login' });
      toast('Đã đặt lại mật khẩu. Vui lòng đăng nhập.');
    }
  };

  const expired =
    submit.error?.code === 'RESET_TOKEN_EXPIRED' || submit.error?.code === 'RESET_TOKEN_INVALID';
  return (
    <View style={styles.form}>
      {step === 'email' && (
        <>
          <AppText muted>Nhập email của tài khoản. Chúng tôi sẽ gửi mã xác minh để đặt lại mật khẩu.</AppText>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={sendCode}
            error={local.email ?? submit.fields.email}
          />
        </>
      )}
      {step === 'otp' && (
        <>
          <AppText muted>
            Nếu email hợp lệ, mã 6 chữ số đã được gửi tới <AppText style={styles.bold}>{email.trim()}</AppText>.
          </AppText>
          <TextField
            label="Mã xác minh"
            value={otp}
            onChangeText={value => setOtp(value.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            onSubmitEditing={verifyCode}
            error={local.otp ?? submit.fields.otp}
          />
        </>
      )}
      {step === 'password' && (
        <>
          <AppText muted>Tạo mật khẩu mới cho tài khoản của bạn.</AppText>
          <TextField
            label="Mật khẩu mới"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint={PASSWORD_HINT}
            error={local.newPassword ?? submit.fields.newPassword}
          />
          <TextField
            label="Nhập lại mật khẩu mới"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={reset}
            error={local.confirmPassword ?? submit.fields.confirmPassword}
          />
        </>
      )}
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {expired ? `${submit.message} Vui lòng yêu cầu mã mới.` : submit.message}
        </AppText>
      )}
      {expired && (
        <Button
          variant="secondary"
          title="Yêu cầu mã mới"
          onPress={() => {
            submit.clear();
            setOtp('');
            setStep('email');
          }}
        />
      )}
      <Button
        title={step === 'email' ? 'Gửi mã' : step === 'otp' ? 'Xác minh' : 'Đặt lại mật khẩu'}
        loading={submit.pending}
        onPress={step === 'email' ? sendCode : step === 'otp' ? verifyCode : reset}
      />
      {step === 'otp' && (
        <Button
          variant="ghost"
          title={cooldown.left > 0 ? `Gửi lại mã sau ${cooldown.left}s` : 'Gửi lại mã'}
          disabled={cooldown.left > 0}
          onPress={async () => {
            const again = await submit.run(
              () => api.forgotPassword(email.trim()),
              error => error.retryAfterSeconds && cooldown.start(error.retryAfterSeconds),
            );
            if (again) {
              cooldown.start(RESEND_SECONDS);
              toast('Nếu email hợp lệ, mã mới đã được gửi.');
            }
          }}
        />
      )}
      <Button
        variant="ghost"
        title="Quay lại đăng nhập"
        onPress={() => {
          setDirty(false);
          open({ name: 'auth', mode: 'login' });
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16 },
  bold: { fontWeight: '700' },
  error: { color: colors.error },
});
