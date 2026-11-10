import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, EmptyState } from '../../shared/ui';

// Authentication is implemented in I01. This entry deliberately grants no session.
export function AuthEntry({
  mode,
  onContinue,
}: {
  mode: 'login' | 'register';
  onContinue: () => void;
}) {
  const { open, close } = useModal();
  return (
    <View style={styles.content}>
      <EmptyState
        icon={<LockKeyhole size={30} color={colors.primary} />}
        title={
          mode === 'login' ? 'Góc học của riêng bạn' : 'Cùng học, cùng tiến bộ'
        }
        description="Tính năng tài khoản đang được hoàn thiện. Bạn vẫn có thể khám phá StudySpace với chế độ Khách."
      />
      <Button
        title="Tiếp tục với chế độ Khách"
        onPress={() => {
          close();
          onContinue();
        }}
      />
      <Button
        variant="ghost"
        title={mode === 'login' ? 'Tìm hiểu về đăng ký' : 'Quay lại đăng nhập'}
        onPress={() =>
          open({ name: 'auth', mode: mode === 'login' ? 'register' : 'login' })
        }
      />
      <AppText variant="caption" muted style={styles.center}>
        Lưu nơi học yêu thích, chia sẻ và quản lý đóng góp trong một tài khoản.
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 16 },
  center: { textAlign: 'center' },
});
