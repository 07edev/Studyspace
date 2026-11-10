import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, TextField } from '../../shared/ui';
import { authApi } from './authApi';
import { EMAIL_PATTERN, useDirtyGuard, useSubmit } from './formHooks';

export const PASSWORD_HINT = 'Tối thiểu 10 ký tự, gồm chữ hoa, chữ thường và chữ số.';
export const passwordIssue = (value: string) =>
  value.length >= 10 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value)
    ? undefined
    : PASSWORD_HINT;

// U01 - Dang ky
export function RegisterForm() {
  const session = useSessionManager();
  const api = useMemo(() => authApi(session), [session]);
  const { open, setDirty } = useModal();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = useSubmit();
  const set = (key: keyof typeof form) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));
  useDirtyGuard(Object.values(form).some(value => value !== ''));

  const onSubmit = async () => {
    const errors: Record<string, string> = {};
    if (form.displayName.trim().length < 2) {
      errors.displayName = 'Tên hiển thị cần tối thiểu 2 ký tự.';
    }
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      errors.email = 'Email không hợp lệ.';
    }
    const pwd = passwordIssue(form.password);
    if (pwd) {
      errors.password = pwd;
    }
    if (form.confirmPassword !== form.password) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const result = await submit.run(() =>
      api.register({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
      }),
    );
    if (result) {
      // Server time vs device clock can differ; never show an absurd countdown.
      const resendIn = result.resendAvailableAt
        ? Math.min(60, Math.max(0, (Date.parse(result.resendAvailableAt) - Date.now()) / 1000))
        : 60;
      setDirty(false);
      open({ name: 'auth', mode: 'verify', email: result.email, resendIn });
    }
  };

  const error = (key: keyof typeof form) => local[key] ?? submit.fields[key];
  return (
    <View style={styles.form}>
      <AppText muted>Tạo tài khoản để lưu nơi học, chia sẻ tài liệu và tham gia cộng đồng.</AppText>
      <TextField
        label="Tên hiển thị"
        value={form.displayName}
        onChangeText={set('displayName')}
        autoComplete="name"
        textContentType="name"
        error={error('displayName')}
      />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        error={error('email')}
      />
      <TextField
        label="Số điện thoại (không bắt buộc)"
        value={form.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        error={error('phone')}
      />
      <TextField
        label="Mật khẩu"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint={PASSWORD_HINT}
        error={error('password')}
      />
      <TextField
        label="Nhập lại mật khẩu"
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSubmit}
        error={error('confirmPassword')}
      />
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button title="Tạo tài khoản" onPress={onSubmit} loading={submit.pending} />
      <Button
        variant="ghost"
        title="Đã có tài khoản? Đăng nhập"
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
  error: { color: colors.error },
});
