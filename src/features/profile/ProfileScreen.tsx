import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Bookmark,
  FileText,
  Heart,
  Info,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import type { FeatureId } from '../../navigation/types';
import { useAuthGate } from '../../shared/auth/AuthGate';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import { AppText, Avatar, Button, Card, MenuGroup, MenuRow, Screen } from '../../shared/ui';
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
  const session = useSession();
  const manager = useSessionManager();
  const { requireAuth } = useAuthGate();
  const user = session.status === 'authenticated' ? session.user : undefined;
  const signedIn = !!user;
  // Show what the server has, not just what the login response carried. Failing quietly is
  // fine: the cached profile stays on screen.
  useEffect(() => {
    if (signedIn) {
      manager.refreshUser().catch(() => undefined);
    }
  }, [signedIn, manager]);
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="caption" muted>
          KHÔNG GIAN CỦA BẠN
        </AppText>
        <AppText variant="title">Cá nhân</AppText>
      </View>
      <Card style={styles.profile}>
        <Avatar uri={user?.profile.avatarUrl} name={user?.profile.displayName} size={74} />
        {user ? (
          <>
            <AppText variant="heading">
              {user.profile.displayName ?? 'Bạn'}
            </AppText>
            <AppText muted style={styles.center}>
              {user.email}
            </AppText>
            {user.profile.bio ? (
              <AppText style={styles.center}>{user.profile.bio}</AppText>
            ) : null}
            <Button
              variant="secondary"
              title="Chỉnh sửa hồ sơ"
              onPress={() => open({ name: 'profile-edit' })}
            />
          </>
        ) : (
          <>
            <AppText variant="heading">Chào bạn mới!</AppText>
            <AppText muted style={styles.center}>
              Đăng nhập để lưu góc học yêu thích và quản lý những đóng góp của bạn.
            </AppText>
            <Button
              title="Đăng nhập / Đăng ký"
              onPress={() => open({ name: 'auth', mode: 'login' })}
            />
          </>
        )}
      </Card>
      <AppText variant="label" muted>
        GÓC HỌC CỦA TÔI
      </AppText>
      <MenuGroup>
        {links.map(({ feature, Icon }) => (
          <MenuRow
            key={feature}
            label={features[feature].title}
            Icon={Icon}
            onPress={() =>
              // Signed in: opens now. Guest: asks to sign in, then opens this same screen.
              // The owning team (TV2/TV3) replaces the pending screen with the real one.
              requireAuth({
                reason: `Đăng nhập để xem ${features[feature].title.toLocaleLowerCase('vi')}.`,
                action: () => open({ name: 'feature', feature }),
              })
            }
          />
        ))}
      </MenuGroup>
      <MenuGroup>
        <MenuRow label="Cài đặt" Icon={Settings} onPress={() => open({ name: 'settings' })} />
        <MenuRow label="Về StudySpace" Icon={Info} onPress={() => open({ name: 'about' })} />
      </MenuGroup>
      <AppText variant="caption" muted style={styles.center}>
        Một không gian nhỏ. Nhiều điều để khám phá.
      </AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { gap: 8 },
  profile: { alignItems: 'center', gap: 16 },
  center: { textAlign: 'center' },
});
