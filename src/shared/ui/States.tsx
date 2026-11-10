import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.state}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText muted style={styles.center}>
        {description}
      </AppText>
      {action && (
        <Button
          variant="secondary"
          title={action.label}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}
export function LoadingState({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={styles.state}
    >
      <ActivityIndicator color={colors.primary} />
      <AppText muted>{label}</AppText>
    </View>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      title="Chưa thể tải nội dung"
      description={message}
      action={onRetry ? { label: 'Thử lại', onPress: onRetry } : undefined}
    />
  );
}
const styles = StyleSheet.create({
  state: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  icon: {
    width: 64,
    height: 64,
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
});
