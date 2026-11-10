import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, TextField, useToast } from '../../shared/ui';
import { useDirtyGuard, useSubmit } from '../auth/formHooks';
import { PASSWORD_HINT, passwordIssue } from '../auth/RegisterForm';
import { profileApi } from './profileApi';

// U49 - Doi mat khau (only for accounts that have a password).
export function ChangePasswordForm() {
  const manager = useSessionManager();
  const { user } = useSession();
  const api = useMemo(() => profileApi(manager), [manager]);
  const { close, setDirty } = useModal();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = useSubmit();
  useDirtyGuard(current !== '' || next !== '' || confirm !== '');

  if (user && !user.authProviders.includes('PASSWORD')) {
    return (
      <View style={styles.form}>
        <AppText>Tài khoản của bạn đăng nhập bằng Google nên không có mật khẩu để đổi.</AppText>
        <Button title="Đóng" variant="secondary" onPress={close} />
      </View>
    );
  }

  const onSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!current) {
      errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }
    const issue = passwordIssue(next);
    if (issue) {
      errors.newPassword = issue;
    } else if (next === current) {
      errors.newPassword = 'Mật khẩu mới cần khác mật khẩu hiện tại.';
    }
    if (confirm !== next) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const done = await submit.run(() =>
      api.changePassword({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
    );
    if (done) {
      setDirty(false);
      close();
      toast('Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.');
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Mật khẩu hiện tại"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        error={local.currentPassword ?? submit.fields.currentPassword}
      />
      <TextField
        label="Mật khẩu mới"
        value={next}
        onChangeText={setNext}
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
        onSubmitEditing={onSubmit}
        error={local.confirmPassword ?? submit.fields.confirmPassword}
      />
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button title="Đổi mật khẩu" onPress={onSubmit} loading={submit.pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  error: { color: colors.error },
});
