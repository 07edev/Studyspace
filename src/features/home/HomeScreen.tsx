import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Compass,
  Search,
  Users,
} from 'lucide-react-native';
import type { AppTabParamList } from '../../navigation/types';
import { useModal } from '../../navigation/ModalCoordinator';
import { useAuthGate } from '../../shared/auth/AuthGate';
import { colors } from '../../shared/theme/tokens';
import { AppText, Card, Screen } from '../../shared/ui';
import { Brand } from '../../shared/ui/Brand';
import { StudyIllustration } from '../welcome/StudyIllustration';

const shortcuts = [
  {
    route: 'Explore',
    title: 'Tìm nơi học',
    text: 'Một góc thật hợp bạn',
    Icon: Compass,
  },
  {
    route: 'Community',
    title: 'Cộng đồng',
    text: 'Chia sẻ và kết nối',
    Icon: Users,
  },
  {
    route: 'Documents',
    title: 'Tài liệu',
    text: 'Thêm kiến thức mới',
    Icon: BookOpen,
  },
] as const;

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  return (
    <Screen>
      <View style={styles.top}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          style={styles.iconButton}
          onPress={() =>
            requireAuth({
              reason: 'Đăng nhập để xem thông báo dành cho bạn.',
              action: () => open({ name: 'feature', feature: 'notifications' }),
            })
          }
        >
          <Bell size={22} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.heading}>
        <AppText variant="caption" style={styles.kicker}>
          CHÀO BẠN, HÔM NAY HỌC GÌ?
        </AppText>
        <AppText variant="title">Một góc học,{'\n'}nhiều cảm hứng.</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Khám phá địa điểm học tập"
        style={styles.search}
        onPress={() => navigation.navigate('Explore')}
      >
        <Search size={21} color={colors.muted} />
        <AppText muted style={styles.grow}>
          Tìm không gian học tập
        </AppText>
        <ArrowUpRight size={20} color={colors.primary} />
      </Pressable>
      <Card style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="heading">Không gian cho{'\n'}ý tưởng lớn.</AppText>
          <AppText muted>Khởi đầu từ một góc học nhỏ.</AppText>
        </View>
        <StudyIllustration />
      </Card>
      <View style={styles.section}>
        <AppText variant="heading">Bắt đầu từ đây</AppText>
        <AppText variant="caption" muted>
          Khám phá StudySpace theo cách của bạn.
        </AppText>
      </View>
      <View style={styles.shortcuts}>
        {shortcuts.map(({ route, title, text, Icon }) => (
          <Pressable
            key={route}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => navigation.navigate(route)}
            style={({ pressed }) => [
              styles.shortcut,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.shortcutIcon}>
              <Icon size={23} color={colors.primary} />
            </View>
            <View style={styles.grow}>
              <AppText variant="label">{title}</AppText>
              <AppText variant="caption" muted>
                {text}
              </AppText>
            </View>
            <ArrowUpRight size={19} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: { gap: 9 },
  kicker: { color: colors.primary, fontWeight: '600', letterSpacing: 0.7 },
  search: {
    minHeight: 56,
    padding: 16,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grow: { flex: 1 },
  hero: {
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  heroCopy: { gap: 6 },
  section: { gap: 4 },
  shortcuts: { gap: 12 },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutIcon: {
    padding: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
  },
  pressed: { opacity: 0.7 },
});
