import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import type { ProfilePatch } from '../../shared/contracts/auth';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, Card, TextField, useToast } from '../../shared/ui';
import { EMAIL_PATTERN, useDirtyGuard, useSubmit } from '../auth/formHooks';
import { profileApi } from './profileApi';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dateOfBirthIssue(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !DATE.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < '1900-01-01'
  ) {
    return 'Nhập ngày sinh theo định dạng YYYY-MM-DD, ví dụ 2003-05-17.';
  }
  return date.getTime() > Date.now() ? 'Ngày sinh không được lớn hơn hôm nay.' : undefined;
}

type TextKey = 'displayName' | 'dateOfBirth' | 'hometown' | 'bio';
const KEYS: TextKey[] = ['displayName', 'dateOfBirth', 'hometown', 'bio'];

// U46 - Chinh sua ho so. mode "complete" is U05 (shown once, right after sign-up, can be skipped).
export function ProfileEditForm({ mode = 'edit' }: { mode?: 'edit' | 'complete' }) {
  const manager = useSessionManager();
  const { user } = useSession();
  const api = useMemo(() => profileApi(manager), [manager]);
  const { open, close, setDirty } = useModal();
  const toast = useToast();
  const profile = user?.profile ?? {};
  const initial: Record<TextKey, string> = {
    displayName: profile.displayName ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    hometown: profile.hometown ?? '',
    bio: profile.bio ?? '',
  };
  const [form, setForm] = useState(initial);
  const [local, setLocal] = useState<Partial<Record<TextKey | 'newEmail', string>>>({});
  const [newEmail, setNewEmail] = useState('');
  const submit = useSubmit();
  const contact = useSubmit();
  const set = (key: TextKey) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const changed = KEYS.filter(key => form[key].trim() !== initial[key]);
  useDirtyGuard(changed.length > 0 || newEmail !== '');

  const onSave = async () => {
    const errors: typeof local = {};
    if (form.displayName.trim().length < 2) {
      errors.displayName = 'Tên hiển thị cần tối thiểu 2 ký tự.';
    }
    const dob = dateOfBirthIssue(form.dateOfBirth.trim());
    if (dob) {
      errors.dateOfBirth = dob;
    }
    if (form.hometown.trim().length > 120) {
      errors.hometown = 'Quê quán tối đa 120 ký tự.';
    }
    if (form.bio.trim().length > 500) {
      errors.bio = 'Giới thiệu tối đa 500 ký tự.';
    }
    setLocal(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    if (changed.length === 0) {
      setDirty(false);
      close();
      return;
    }
    // Only what changed is sent; an emptied optional field is cleared with null.
    const patch: ProfilePatch = {};
    for (const key of changed) {
      const value = form[key].trim();
      patch[key] = key === 'displayName' ? value : value || null;
    }
    const saved = await submit.run(() => api.patchProfile(patch));
    if (saved) {
      manager.setUser(saved);
      setDirty(false);
      close();
      toast('Đã lưu hồ sơ.');
    }
  };

  const onChangeEmail = async () => {
    const value = newEmail.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setLocal({ newEmail: 'Email không hợp lệ.' });
      return;
    }
    if (value.toLowerCase() === user?.email.toLowerCase()) {
      setLocal({ newEmail: 'Đây đang là email của bạn.' });
      return;
    }
    if (changed.length > 0) {
      // Opening the code dialog replaces this form, so unsaved profile edits would be lost.
      setLocal({ newEmail: 'Hãy lưu những thay đổi hồ sơ trước khi đổi email.' });
      return;
    }
    setLocal({});
    const challenge = await contact.run(() =>
      api.requestContactChange({ channel: 'EMAIL', newValue: value }),
    );
    if (challenge) {
      setDirty(false); // the half-typed new email is carried by the code dialog from here on
      open({ name: 'contact-verify', challenge });
    }
  };

  const error = (key: TextKey) => local[key] ?? submit.fields[key];
  return (
    <View style={styles.form}>
      {mode === 'complete' && (
        <AppText muted>
          Thêm vài thông tin để mọi người biết bạn là ai. Bạn có thể bỏ qua và cập nhật sau trong Cài đặt.
        </AppText>
      )}
      <TextField
        label="Tên hiển thị"
        value={form.displayName}
        onChangeText={set('displayName')}
        autoComplete="name"
        textContentType="name"
        error={error('displayName')}
      />
      <TextField
        label="Ngày sinh"
        value={form.dateOfBirth}
        onChangeText={set('dateOfBirth')}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        maxLength={10}
        hint="Định dạng YYYY-MM-DD. Để trống nếu không muốn cung cấp."
        error={error('dateOfBirth')}
      />
      <TextField
        label="Quê quán"
        value={form.hometown}
        onChangeText={set('hometown')}
        error={error('hometown')}
      />
      <TextField
        label="Giới thiệu bản thân"
        value={form.bio}
        onChangeText={set('bio')}
        multiline
        textAlignVertical="top"
        style={styles.bio}
        hint={`${form.bio.trim().length}/500 ký tự`}
        error={error('bio')}
      />
      <Card style={styles.pending}>
        <AppText variant="label">Ảnh đại diện, trường, ngành và môn quan tâm</AppText>
        <AppText variant="caption" muted>
          Các mục này sẽ có khi dịch vụ tải ảnh và danh mục trường/ngành/môn học sẵn sàng.
        </AppText>
      </Card>
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button title="Lưu hồ sơ" onPress={onSave} loading={submit.pending} />
      {mode === 'complete' ? (
        <Button
          variant="ghost"
          title="Để sau"
          onPress={() => {
            setDirty(false);
            close();
          }}
        />
      ) : (
        <View style={styles.section}>
          <AppText variant="heading">Thông tin liên hệ</AppText>
          <AppText muted>Email hiện tại: {user?.email}</AppText>
          {user?.phone ? <AppText muted>Số điện thoại: {user.phone}</AppText> : null}
          <TextField
            label="Email mới"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            hint="Chúng tôi sẽ gửi mã xác minh tới email mới trước khi đổi."
            error={local.newEmail ?? contact.fields.newValue}
          />
          {contact.message && (
            <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
              {contact.message}
            </AppText>
          )}
          <Button
            variant="secondary"
            title="Gửi mã xác minh"
            onPress={onChangeEmail}
            loading={contact.pending}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  bio: { minHeight: 110 },
  pending: { backgroundColor: colors.primarySoft, gap: 6 },
  section: { gap: 12, marginTop: 8 },
  error: { color: colors.error },
});
