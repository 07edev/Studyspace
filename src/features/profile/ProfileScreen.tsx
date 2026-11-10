import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Bookmark,
  ChevronRight,
  FileText,
  Heart,
  Info,
  Send,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import type { FeatureId } from '../../navigation/types';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, Card, Screen } from '../../shared/ui';
import { features } from '../pending/features';

const links: { feature: FeatureId; Icon: LucideIcon }[] = [
  { feature: 'favorites', Icon: Heart },
  { feature: 'suggestions', Icon: Send },
  { feature: 'my-posts', Icon: FileText },
  { feature: 'saved-posts', Icon: Bookmark },
  { feature: 'my-documents', Icon: FileText },
];

export function ProfileScreen() {
  const { open } = useModal();
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="caption" muted>
          KHÔNG GIAN CỦA BẠN
        </AppText>
        <AppText variant="title">Cá nhân</AppText>
      </View>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <UserRound size={32} color={colors.primary} />
        </View>
        <AppText variant="heading">Chào bạn mới!</AppText>
        <AppText muted style={styles.center}>
          Đăng nhập để lưu góc học yêu thích và quản lý những đóng góp của bạn.
        </AppText>
        <Button
          title="Đăng nhập / Đăng ký"
          onPress={() => open({ name: 'auth', mode: 'login' })}
        />
      </Card>
      <AppText variant="label" muted>
        GÓC HỌC CỦA TÔI
      </AppText>
      <View style={styles.group}>
        {links.map(({ feature, Icon }) => (
          <Pressable
            key={feature}
            accessibilityRole="button"
            style={styles.row}
            onPress={() =>
              open({
                name: 'auth-required',
                reason: `Đăng nhập để xem ${features[
                  feature
                ].title.toLocaleLowerCase('vi')}.`,
              })
            }
          >
            <Icon size={21} color={colors.primary} />
            <AppText style={styles.grow}>{features[feature].title}</AppText>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <View style={styles.group}>
        <Pressable
          accessibilityRole="button"
          style={styles.row}
          onPress={() => open({ name: 'settings' })}
        >
          <Settings size={21} color={colors.primary} />
          <AppText style={styles.grow}>Cài đặt</AppText>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.row}
          onPress={() => open({ name: 'about' })}
        >
          <Info size={21} color={colors.primary} />
          <AppText style={styles.grow}>Về StudySpace</AppText>
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      </View>
      <AppText variant="caption" muted style={styles.center}>
        Một không gian nhỏ. Nhiều điều để khám phá.
      </AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { gap: 8 },
  profile: { alignItems: 'center', gap: 16 },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
    minHeight: 60,
  },
  grow: { flex: 1 },
});
