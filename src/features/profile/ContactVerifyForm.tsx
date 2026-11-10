import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import type { ContactChallenge } from '../../shared/contracts/auth';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, TextField, useToast } from '../../shared/ui';
import { useDirtyGuard, useSubmit } from '../auth/formHooks';
import { profileApi } from './profileApi';

// U47 - Xac minh thay doi lien he: the code goes to the NEW address; only then is it saved.
export function ContactVerifyForm({ challenge }: { challenge: ContactChallenge }) {
  const manager = useSessionManager();
  const api = useMemo(() => profileApi(manager), [manager]);
  const { close, setDirty } = useModal();
  const toast = useToast();
  const [otp, setOtp] = useState('');
  const [local, setLocal] = useState<string>();
  const submit = useSubmit();
  useDirtyGuard(otp !== '');

  const onConfirm = async () => {
    if (!/^[0-9]{6}$/.test(otp)) {
      setLocal('Mã gồm 6 chữ số.');
      return;
    }
    setLocal(undefined);
    const user = await submit.run(() =>
      api.confirmContactChange({ challengeId: challenge.challengeId, otp }),
    );
    if (user) {
      manager.setUser(user);
      setDirty(false);
      close();
      toast('Đã cập nhật thông tin liên hệ.');
    }
  };

  return (
    <View style={styles.form}>
      <AppText muted>
        Mã gồm 6 chữ số đã được gửi tới{' '}
        <AppText style={styles.bold}>{challenge.maskedDestination}</AppText>. Mã có hiệu lực trong 5 phút.
      </AppText>
      <TextField
        label="Mã xác minh"
        value={otp}
        onChangeText={value => setOtp(value.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={onConfirm}
        error={local ?? submit.fields.otp}
      />
      {submit.message && (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      )}
      <Button title="Xác nhận" onPress={onConfirm} loading={submit.pending} />
      <Button
        variant="ghost"
        title="Hủy"
        onPress={() => {
          setDirty(false);
          close();
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
