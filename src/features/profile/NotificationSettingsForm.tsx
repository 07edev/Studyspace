import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import type { NotificationSettings } from '../../shared/contracts/auth';
import { AppText, ErrorState, LoadingState, SwitchRow } from '../../shared/ui';
import { profileApi } from './profileApi';
import { useRemoteSettings } from './useRemoteSettings';

const rows: { key: keyof NotificationSettings; label: string; description: string }[] = [
  { key: 'postInteraction', label: 'Tương tác bài viết', description: 'Bình luận, lượt thích và phản hồi bài viết của bạn.' },
  { key: 'moderation', label: 'Kiểm duyệt', description: 'Kết quả xử lý bài viết, tài liệu và báo cáo của bạn.' },
  { key: 'adminMessage', label: 'Tin nhắn từ quản trị viên', description: 'Thông báo trực tiếp từ đội ngũ StudySpace.' },
  { key: 'system', label: 'Thông báo hệ thống', description: 'Cập nhật chung về ứng dụng.' },
  { key: 'pushEnabled', label: 'Thông báo đẩy', description: 'Nhận thông báo trên thiết bị này.' },
];

// U51 - Cai dat thong bao
export function NotificationSettingsForm() {
  const manager = useSessionManager();
  const api = useMemo(() => profileApi(manager), [manager]);
  const { value, loadError, saving, reload, update } = useRemoteSettings(
    api.getNotificationSettings,
    api.patchNotificationSettings,
  );
  if (loadError) {
    return <ErrorState message={loadError} onRetry={reload} />;
  }
  if (!value) {
    return <LoadingState label="Đang tải cài đặt thông báo…" />;
  }
  return (
    <View style={styles.form}>
      {rows.map(row => (
        <SwitchRow
          key={row.key}
          label={row.label}
          description={row.description}
          value={value[row.key]}
          disabled={saving}
          onValueChange={on => update({ [row.key]: on })}
        />
      ))}
      <AppText variant="caption" muted>
        Quyền nhận thông báo của hệ điều hành do bạn cấp trong Cài đặt thiết bị, không do ứng dụng quyết định.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: 8 } });
