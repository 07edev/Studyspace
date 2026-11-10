import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell, KeyRound, ShieldCheck, UserPen, type LucideIcon } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import type { ModalRoute } from '../../navigation/types';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, EmptyState, MenuGroup, MenuRow, SwitchRow, TextField, useToast } from '../../shared/ui';
import { useDirtyGuard, useSubmit } from '../auth/formHooks';
import { profileApi } from './profileApi';

const items: { route: ModalRoute; label: string; Icon: LucideIcon; passwordOnly?: boolean }[] = [
  { route: { name: 'profile-edit' }, label: 'Chỉnh sửa hồ sơ', Icon: UserPen },
  { route: { name: 'privacy' }, label: 'Quyền riêng tư', Icon: ShieldCheck },
  { route: { name: 'notifications' }, label: 'Cài đặt thông báo', Icon: Bell },
  { route: { name: 'change-password' }, label: 'Đổi mật khẩu', Icon: KeyRound, passwordOnly: true },
];

// U48 - Cai dat (signed in). Opening a row only navigates; nothing here signs the user out by itself.
export function SettingsPanel() {
  const { user } = useSession();
  const { open } = useModal();
  const hasPassword = user?.authProviders.includes('PASSWORD') ?? false;
  return (
    <View style={styles.form}>
      <View style={styles.account}>
        <AppText variant="heading">{user?.profile.displayName ?? user?.email}</AppText>
        <AppText muted>{user?.email}</AppText>
      </View>
      <MenuGroup>
        {items
          .filter(item => !item.passwordOnly || hasPassword)
          .map(({ route, label, Icon }) => (
            <MenuRow key={label} label={label} Icon={Icon} onPress={() => open(route)} />
          ))}
      </MenuGroup>
      <Button title="Đăng xuất" variant="secondary" onPress={() => open({ name: 'logout-confirm' })} />
      <Button title="Xóa tài khoản" variant="ghost" onPress={() => open({ name: 'delete-account' })} />
    </View>
  );
}

// U52 - Xac nhan dang xuat
export function LogoutConfirm({ onGuest }: { onGuest: () => void }) {
  const manager = useSessionManager();
  const { close } = useModal();
  const toast = useToast();
  const submit = useSubmit();
  const onConfirm = async () => {
    const done = await submit.run(async () => {
      await manager.logout();
      return true;
    });
    if (done) {
      close();
      onGuest();
      toast('Bạn đã đăng xuất.');
    }
  };
  return (
    <View style={styles.form}>
      <AppText>Bạn có chắc muốn đăng xuất khỏi thiết bị này không?</AppText>
      <Button title="Đăng xuất" onPress={onConfirm} loading={submit.pending} />
      <Button title="Ở lại" variant="ghost" onPress={close} />
    </View>
  );
}

// U53 - Yeu cau xoa tai khoan. The server only records the request; the account is removed later.
export function DeleteAccountForm({ onGuest }: { onGuest: () => void }) {
  const manager = useSessionManager();
  const { user } = useSession();
  const api = useMemo(() => profileApi(manager), [manager]);
  const { close, setDirty } = useModal();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const submit = useSubmit();
  const hasPassword = user?.authProviders.includes('PASSWORD') ?? false;
  useDirtyGuard(!done && (confirmed || password !== '' || reason !== ''));

  if (done) {
    return (
      <View style={styles.form}>
        <EmptyState
          title="Đã tiếp nhận yêu cầu"
          description="Chúng tôi đã nhận yêu cầu xóa tài khoản của bạn và bạn đã được đăng xuất khỏi thiết bị này."
        />
        <Button
          title="Đóng"
          onPress={() => {
            close();
            onGuest();
          }}
        />
      </View>
    );
  }

  const onSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!confirmed) {
      errors.confirm = 'Bạn cần xác nhận để tiếp tục.';
    }
    if (hasPassword && !password) {
      errors.password = 'Vui lòng nhập mật khẩu để xác thực.';
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const accepted = await submit.run(() =>
      api.requestDeletion({
        confirm: true,
        password: hasPassword ? password : undefined,
        reason: reason.trim() || undefined,
      }),
    );
    if (accepted) {
      setDirty(false);
      // The request is recorded; end this session too so nothing stays signed in.
      await manager.logout();
      setDone(true);
    }
  };

  const reauth = submit.error?.code === 'REAUTH_REQUIRED';
  return (
    <View style={styles.form}>
      <AppText>
        Khi tài khoản bị xóa, hồ sơ của bạn sẽ không còn hiển thị. Việc này không thể hoàn tác sau khi hệ thống xử lý.
      </AppText>
      {hasPassword && (
        <TextField
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          hint="Nhập mật khẩu để xác nhận đây là bạn."
          error={local.password ?? submit.fields.password}
        />
      )}
      <TextField
        label="Lý do (không bắt buộc)"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={styles.reason}
        error={submit.fields.reason}
      />
      <SwitchRow
        label="Tôi hiểu và muốn xóa tài khoản"
        value={confirmed}
        onValueChange={setConfirmed}
      />
      {(local.confirm ?? submit.fields.confirm) && (
        <AppText variant="caption" style={styles.error}>
          {local.confirm ?? submit.fields.confirm}
        </AppText>
      )}
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {reauth && !hasPassword
            ? `${submit.message} Hãy đăng xuất, đăng nhập lại bằng Google rồi thử lại.`
            : submit.message}
        </AppText>
      )}
      <Button title="Gửi yêu cầu xóa tài khoản" onPress={onSubmit} loading={submit.pending} />
      <Button title="Giữ tài khoản" variant="ghost" onPress={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  account: { gap: 4 },
  reason: { minHeight: 90 },
  error: { color: colors.error },
});
