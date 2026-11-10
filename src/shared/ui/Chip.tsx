import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { AppText } from './AppText';

type Props = {
  label: string;
  // Provide `selected` + `onPress` for a filter chip; leave both out for a plain tag.
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

export function Chip({ label, selected, onPress, disabled, testID }: Props) {
  const interactive = !!onPress;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={interactive ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={interactive ? { selected: !!selected, disabled: !!disabled } : undefined}
      disabled={!interactive || disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.on, disabled && styles.disabled]}
    >
      <AppText variant="caption" style={[styles.label, selected && styles.labelOn]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  label: { color: colors.ink },
  labelOn: { color: colors.surface },
});
