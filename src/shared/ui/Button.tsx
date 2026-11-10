import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii } from '../theme/tokens';
import { AppText } from './AppText';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  testID,
  style,
}: Props) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!unavailable, busy: !!loading }}
      testID={testID}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        style,
        unavailable && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.surface : colors.primary}
        />
      ) : (
        icon
      )}
      <AppText
        variant="label"
        style={[styles.label, variant === 'primary' ? styles.white : styles.green]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },
  white: { color: colors.surface },
  label: {flexShrink: 1, textAlign: 'center'},
  green: { color: colors.primary },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
