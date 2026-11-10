import React, { useId } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { AppText } from './AppText';

type Props = TextInputProps & { label: string; error?: string; hint?: string };
export function TextField({ label, error, hint, style, ...props }: Props) {
  const id = useId();
  return (
    <View style={styles.group}>
      <AppText nativeID={id} variant="label">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={id}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        {...props}
        style={[styles.input, error && styles.invalid, style]}
      />
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          variant="caption"
          style={styles.error}
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 8 },
  input: {
    minHeight: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  invalid: { borderColor: colors.error },
  error: { color: colors.error },
});
