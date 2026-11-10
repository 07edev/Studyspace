import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import { AppText, ErrorState, LoadingState, SwitchRow } from '../../shared/ui';
import { profileApi } from './profileApi';
import { useRemoteSettings } from './useRemoteSettings';

// U50 - Quyen rieng tu
export function PrivacyForm() {
  const manager = useSessionManager();
  const api = useMemo(() => profileApi(manager), [manager]);
  const { value, loadError, saving, reload, update } = useRemoteSettings(
    api.getPrivacy,
    api.patchPrivacy,
  );
  if (loadError) {
    return <ErrorState message={loadError} onRetry={reload} />;
  }
  if (!value) {
    return <LoadingState label="Đang tải quyền riêng tư…" />;
  }
  const isPublic = value.profileVisibility === 'PUBLIC';
  return (
    <View style={styles.form}>
      <SwitchRow
        label="Hồ sơ công khai"
        description={
          isPublic
            ? 'Mọi người có thể xem giới thiệu của bạn.'
            : 'Chỉ hiển thị tên và ảnh đại diện của bạn.'
        }
        value={isPublic}
        disabled={saving}
        onValueChange={on => update({ profileVisibility: on ? 'PUBLIC' : 'PRIVATE' })}
      />
      <SwitchRow
        label="Hiển thị trường"
        description="Chỉ có tác dụng khi hồ sơ công khai."
        value={value.showUniversity}
        disabled={saving}
        onValueChange={on => update({ showUniversity: on })}
      />
      <SwitchRow
        label="Hiển thị ngành"
        description="Chỉ có tác dụng khi hồ sơ công khai."
        value={value.showMajor}
        disabled={saving}
        onValueChange={on => update({ showMajor: on })}
      />
      <AppText variant="caption" muted>
        Thay đổi được lưu ngay khi bạn bật hoặc tắt.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: 8 } });
