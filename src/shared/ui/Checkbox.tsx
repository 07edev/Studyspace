import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  error?: string;
  disabled?: boolean;
  testID?: string;
};

// A labelled tick box (multi-choice lists, "I agree" lines). For on/off settings use SwitchRow.
export function Checkbox({ label, checked, onChange, description, error, disabled, testID }: Props) {
  return (
    <View style={styles.group}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={[styles.row, disabled && styles.disabled]}
      >
        <View style={[styles.box, checked && styles.boxOn]}>
          {checked && <Check size={16} color={colors.surface} strokeWidth={3} />}
        </View>
        <View style={styles.text}>
          <AppText>{label}</AppText>
          {description ? (
            <AppText variant="caption" muted>
              {description}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {error ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
  error: { color: colors.error },
});
