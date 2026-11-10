import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRight, BookOpen, MapPin, Users } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, Screen } from '../../shared/ui';
import { Brand } from '../../shared/ui/Brand';
import { StudyIllustration } from './StudyIllustration';

export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { open } = useModal();
  return (
    <Screen bottom contentStyle={styles.content}>
      <Brand />
      <View style={styles.hero}>
        <StudyIllustration />
        <AppText variant="caption" style={styles.eyebrow}>
          KHÔNG GIAN TỐT. HỌC TẬP TỐT.
        </AppText>
        <AppText variant="hero" style={styles.center}>
          Tìm góc học.{'\n'}Mở cảm hứng.
        </AppText>
        <AppText muted style={styles.subtitle}>
          Khám phá nơi học phù hợp, chia sẻ tài liệu và cùng nhau tiến bộ mỗi
          ngày.
        </AppText>
      </View>
      <View style={styles.features}>
        <View style={styles.feature}>
          <MapPin size={20} color={colors.primary} />
          <AppText variant="caption">Nơi học</AppText>
        </View>
        <View style={styles.feature}>
          <Users size={20} color={colors.primary} />
          <AppText variant="caption">Cộng đồng</AppText>
        </View>
        <View style={styles.feature}>
          <BookOpen size={20} color={colors.primary} />
          <AppText variant="caption">Tài liệu</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          title="Bắt đầu khám phá"
          testID="welcome-guest"
          onPress={onContinue}
          icon={<ArrowRight size={19} color={colors.surface} />}
        />
        <Button
          title="Đăng nhập"
          variant="secondary"
          onPress={() => open({ name: 'auth', mode: 'login' })}
        />
        <Button
          title="Chưa có tài khoản? Đăng ký"
          variant="ghost"
          onPress={() => open({ name: 'auth', mode: 'register' })}
        />
        <AppText variant="caption" muted style={styles.center}>
          Bạn có thể khám phá với chế độ Khách.
        </AppText>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { gap: 20 },
  hero: { gap: 12 },
  center: { textAlign: 'center' },
  eyebrow: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  subtitle: { textAlign: 'center', paddingHorizontal: 8 },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  feature: { alignItems: 'center', gap: 7 },
  actions: { gap: 10, marginTop: 'auto' },
});
