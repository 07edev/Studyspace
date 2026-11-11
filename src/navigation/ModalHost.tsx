import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LockKeyhole, X } from 'lucide-react-native';
import { AuthModal, authTitles } from '../features/auth/AuthModal';
import { DeleteAccountForm, LogoutConfirm, SettingsPanel } from '../features/profile/AccountSettings';
import { ChangePasswordForm } from '../features/profile/ChangePasswordForm';
import { ContactVerifyForm } from '../features/profile/ContactVerifyForm';
import { NotificationSettingsForm } from '../features/profile/NotificationSettingsForm';
import { PrivacyForm } from '../features/profile/PrivacyForm';
import { ProfileEditForm } from '../features/profile/ProfileEditForm';
import { useSession } from '../shared/auth/AuthProvider';
import { features } from '../features/pending/features';
import { PendingFeature } from '../features/pending/PendingFeatureScreen';
import { colors } from '../shared/theme/tokens';
import { AppText, Button, ConfirmDialog, EmptyState, useConfirmHost } from '../shared/ui';
import { useModal } from './ModalCoordinator';
import type { ModalRoute, ModalSize } from './types';

function presentation(
  route: ModalRoute,
  signedIn: boolean,
): { title: string; size: ModalSize } {
  switch (route.name) {
    case 'auth':
      return { title: authTitles[route.mode], size: 'F' };
    case 'session-ended':
      return { title: 'Phiên đã kết thúc', size: 'C' };
    case 'auth-required':
      return { title: 'Đăng nhập để tiếp tục', size: 'C' };
    case 'feature':
      return { title: features[route.feature].title, size: 'L' };
    case 'settings':
      return { title: 'Cài đặt', size: signedIn ? 'F' : 'L' };
    case 'profile-edit':
      return {
        title: route.mode === 'complete' ? 'Hoàn thiện hồ sơ' : 'Chỉnh sửa hồ sơ',
        size: 'F',
      };
    case 'contact-verify':
      return { title: 'Xác minh thay đổi', size: 'C' };
    case 'change-password':
      return { title: 'Đổi mật khẩu', size: 'F' };
    case 'privacy':
      return { title: 'Quyền riêng tư', size: 'L' };
    case 'notifications':
      return { title: 'Cài đặt thông báo', size: 'L' };
    case 'logout-confirm':
      return { title: 'Đăng xuất', size: 'C' };
    case 'delete-account':
      return { title: 'Xóa tài khoản', size: 'L' };
    case 'about':
      return { title: 'Về StudySpace', size: 'L' };
  }
}

function ModalContent({
  route,
  onGuest,
  onContinue,
}: {
  route: ModalRoute;
  onGuest: () => void;
  onContinue: () => void;
}) {
  const { open, close } = useModal();
  const session = useSession();
  switch (route.name) {
    case 'auth':
      return <AuthModal route={route} onAuthenticated={onContinue} />;
    case 'session-ended':
      return (
        <View style={styles.content}>
          <EmptyState
            icon={<LockKeyhole size={28} color={colors.primary} />}
            title={
              route.reason === 'suspended'
                ? 'Tài khoản đang bị khóa'
                : 'Phiên đăng nhập đã hết hạn'
            }
            description={
              route.reason === 'suspended'
                ? 'Tài khoản của bạn hiện không thể sử dụng. Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên.'
                : 'Vì lý do bảo mật, bạn cần đăng nhập lại để tiếp tục. Bạn vẫn có thể xem nội dung công khai.'
            }
          />
          {route.reason === 'expired' && (
            <Button
              title="Đăng nhập lại"
              onPress={() => open({ name: 'auth', mode: 'login' })}
            />
          )}
          <Button title="Để sau" variant="ghost" onPress={close} />
        </View>
      );
    case 'auth-required':
      return (
        <View style={styles.content}>
          <EmptyState
            icon={<LockKeyhole size={28} color={colors.primary} />}
            title="Bạn cần đăng nhập"
            description={route.reason}
          />
          <Button
            title="Đăng nhập"
            onPress={() => open({ name: 'auth', mode: 'login' })}
          />
          <Button
            title="Tạo tài khoản"
            variant="secondary"
            onPress={() => open({ name: 'auth', mode: 'register' })}
          />
          <Button title="Để sau" variant="ghost" onPress={close} />
        </View>
      );
    case 'feature':
      return <PendingFeature feature={route.feature} />;
    case 'settings':
      if (session.status === 'authenticated') {
        return <SettingsPanel />;
      }
      return (
        <View style={styles.content}>
          <AppText>Bạn đang sử dụng chế độ Khách.</AppText>
          <AppText muted>
            Đăng nhập để quản lý hồ sơ, quyền riêng tư và cài đặt thông báo của
            bạn.
          </AppText>
          <Button
            title="Đăng nhập"
            onPress={() => open({ name: 'auth', mode: 'login' })}
          />
          <Button
            title="Về màn hình chào mừng"
            variant="secondary"
            onPress={() => {
              close();
              onGuest();
            }}
          />
        </View>
      );
    case 'delete-account':
      // Handles its own signed-out state: it signs the user out once the request is accepted.
      return <DeleteAccountForm onGuest={onGuest} />;
    case 'profile-edit':
    case 'contact-verify':
    case 'change-password':
    case 'privacy':
    case 'notifications':
    case 'logout-confirm':
      if (session.status !== 'authenticated') {
        return (
          <View style={styles.content}>
            <EmptyState
              icon={<LockKeyhole size={28} color={colors.primary} />}
              title="Cần đăng nhập"
              description="Đăng nhập để tiếp tục."
            />
            <Button title="Đăng nhập" onPress={() => open({ name: 'auth', mode: 'login' })} />
            <Button title="Để sau" variant="ghost" onPress={close} />
          </View>
        );
      }
      switch (route.name) {
        case 'profile-edit':
          return <ProfileEditForm mode={route.mode} />;
        case 'contact-verify':
          return <ContactVerifyForm challenge={route.challenge} />;
        case 'change-password':
          return <ChangePasswordForm />;
        case 'privacy':
          return <PrivacyForm />;
        case 'notifications':
          return <NotificationSettingsForm />;
        default:
          return <LogoutConfirm onGuest={onGuest} />;
      }
    case 'about':
      return (
        <View style={styles.content}>
          <AppText variant="title">Học tập có không gian.</AppText>
          <AppText muted>
            StudySpace giúp bạn khám phá không gian học tập, chia sẻ tài liệu và
            kết nối với cộng đồng cùng học.
          </AppText>
          <AppText variant="caption" muted>
            StudySpace · Giai đoạn phát triển đầu tiên
          </AppText>
          <Button title="Tiếp tục khám phá" onPress={close} />
        </View>
      );
  }
}

export function ModalHost({
  onWelcome,
  onContinue,
}: {
  onWelcome: () => void;
  onContinue: () => void;
}) {
  const { state, close, stay, discard } = useModal();
  const { request, answer } = useConfirmHost();
  const session = useSession();
  // A question asked with useConfirm() while no modal is open (e.g. on a tab): ModalHost is the only
  // owner of native Modals, so it shows a compact one.
  if (!state.active) {
    return request ? (
      <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => answer(false)}>
        <View style={[styles.overlay, styles.center]}>
          <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={() => answer(false)} />
          <View style={[styles.panel, styles.compact]}>
            <ConfirmDialog
              {...request}
              onConfirm={() => answer(true)}
              onCancel={() => answer(false)}
            />
          </View>
        </View>
      </Modal>
    ) : null;
  }
  const covered = !!state.pending || !!request;
  const { title, size } = presentation(state.active, session.status === 'authenticated');
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={request ? () => answer(false) : state.pending ? stay : close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, size === 'C' ? styles.center : styles.bottom]}
      >
        {size !== 'F' && (
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={request ? () => answer(false) : state.pending ? stay : close}
          />
        )}
        <SafeAreaView
          edges={
            size === 'F'
              ? ['top', 'bottom', 'left', 'right']
              : ['bottom', 'left', 'right']
          }
          style={[
            styles.panel,
            size === 'F'
              ? styles.full
              : size === 'C'
              ? styles.compact
              : styles.large,
          ]}
        >
          <View
            accessibilityElementsHidden={covered}
            importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
            style={[styles.body, covered && styles.hidden]}
          >
            <View style={styles.header}>
              <AppText variant="heading" style={styles.grow}>
                {title}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                testID="modal-close"
                onPress={close}
                style={styles.close}
              >
                <X size={23} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}
            >
              <ModalContent
                key={state.revision}
                route={state.active}
                onGuest={onWelcome}
                onContinue={onContinue}
              />
            </ScrollView>
          </View>
          {request && (
            <ConfirmDialog
              {...request}
              onConfirm={() => answer(true)}
              onCancel={() => answer(false)}
            />
          )}
          {!request && state.pending && (
            <View style={styles.confirm}>
              <AppText variant="heading">Rời khỏi form?</AppText>
              <AppText muted>
                Những thay đổi chưa lưu sẽ bị bỏ. Bạn có muốn tiếp tục chỉnh
                sửa?
              </AppText>
              <Button title="Tiếp tục chỉnh sửa" onPress={stay} />
              <Button
                title="Bỏ thay đổi"
                variant="secondary"
                onPress={discard}
              />
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay },
  center: { justifyContent: 'center', padding: 24 },
  bottom: { justifyContent: 'flex-end' },
  panel: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  full: { flex: 1 },
  compact: { maxHeight: '90%', borderRadius: 24 },
  large: {
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  body: { flexShrink: 1 },
  hidden: { display: 'none' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 24,
    paddingRight: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  grow: { flex: 1 },
  close: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 24, paddingBottom: 32 },
  content: { gap: 18 },
  confirm: { padding: 24, gap: 18 },
});
