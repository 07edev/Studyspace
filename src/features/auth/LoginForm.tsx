import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import { AppText, Button, TextField, useToast } from '../../shared/ui';
import { authApi } from './authApi';
import { GoogleSignInButton } from './GoogleSignInButton';
import { EMAIL_PATTERN, useDirtyGuard, useSubmit } from './formHooks';

// U03 - Dang nhap
export function LoginForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const session = useSessionManager();
  const api = useMemo(() => authApi(session), [session]);
  const { open, close, setDirty } = useModal();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = useSubmit();
  useDirtyGuard(email !== '' || password !== '');

  const goTo = (route: Parameters<typeof open>[0]) => {
    setDirty(false);
    open(route);
  };

  const onSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Email không hợp lệ.';
    }
    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const done = await submit.run(async () => {
      await session.startSession(
        await api.login({ email: email.trim(), password }),
      );
      return true;
    });
    if (done) {
      setDirty(false);
      close();
      onAuthenticated();
      toast('Chào mừng bạn trở lại!');
    }
  };

  const unverified = submit.error?.code === 'EMAIL_NOT_VERIFIED';
  return (
    <View style={styles.form}>
      <AppText muted>Đăng nhập để lưu nơi học yêu thích và quản lý đóng góp.</AppText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        error={local.email ?? submit.fields.email}
      />
      <TextField
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        error={local.password ?? submit.fields.password}
      />
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button title="Đăng nhập" onPress={onSubmit} loading={submit.pending} />
      <GoogleSignInButton onAuthenticated={onAuthenticated} />
      {unverified && (
        <Button
          title="Xác minh email"
          variant="secondary"
          onPress={() => goTo({ name: 'auth', mode: 'verify', email: email.trim() })}
        />
      )}
      <Button
        variant="ghost"
        title="Quên mật khẩu?"
        onPress={() => goTo({ name: 'auth', mode: 'forgot' })}
      />
      <Button
        variant="ghost"
        title="Chưa có tài khoản? Đăng ký"
        onPress={() => goTo({ name: 'auth', mode: 'register' })}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: 16 },
  error: { color: '#A53636' },
});
