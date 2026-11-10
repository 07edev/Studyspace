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
import { AuthEntry } from '../features/auth/AuthEntry';
import { features } from '../features/pending/features';
import { PendingFeature } from '../features/pending/PendingFeatureScreen';
import { colors } from '../shared/theme/tokens';
import { AppText, Button, EmptyState } from '../shared/ui';
import { useModal } from './ModalCoordinator';
import type { ModalRoute, ModalSize } from './types';

function presentation(route: ModalRoute): { title: string; size: ModalSize } {
  switch (route.name) {
    case 'auth':
      return {
        title: route.mode === 'login' ? 'Đăng nhập' : 'Đăng ký',
        size: 'F',
      };
    case 'auth-required':
      return { title: 'Đăng nhập để tiếp tục', size: 'C' };
    case 'feature':
      return { title: features[route.feature].title, size: 'L' };
    case 'settings':
      return { title: 'Cài đặt', size: 'L' };
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
  switch (route.name) {
    case 'auth':
      return <AuthEntry mode={route.mode} onContinue={onContinue} />;
    case 'auth-required':
      return (
        <View style={styles.content}>
          <EmptyState
            icon={<LockKeyhole size={28} color={colors.primary} />}
            title="Lưu lại hành trình học tập"
            description={route.reason}
          />
          <Button
            title="Đăng nhập"
            onPress={() => open({ name: 'auth', mode: 'login' })}
          />
          <Button title="Để sau" variant="ghost" onPress={close} />
        </View>
      );
    case 'feature':
      return <PendingFeature feature={route.feature} />;
    case 'settings':
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
  if (!state.active) {
    return null;
  }
  const { title, size } = presentation(state.active);
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={state.pending ? stay : close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, size === 'C' ? styles.center : styles.bottom]}
      >
        {size !== 'F' && (
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={state.pending ? stay : close}
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
            accessibilityElementsHidden={!!state.pending}
            importantForAccessibility={
              state.pending ? 'no-hide-descendants' : 'auto'
            }
            style={[styles.body, state.pending && styles.hidden]}
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
          {state.pending && (
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
