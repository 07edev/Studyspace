import React, { useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors, radii } from '../theme/tokens';
import { AppText } from './AppText';

export type SelectOption<T extends string = string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
};

/**
 * Pick one value from a SHORT fixed list (about 10 or fewer): the list opens inline under the field,
 * so it works inside any modal without stacking another one. Long or searchable lists
 * (universities, provinces) should be their own screen, like U07/U08.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Chọn một mục',
  error,
  hint,
  disabled,
}: Props<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <View style={styles.group}>
      <AppText nativeID={id} variant="label">
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={selected ? `Đang chọn ${selected.label}` : placeholder}
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(prev => !prev)}
        style={[styles.field, !!error && styles.invalid, disabled && styles.disabled]}
      >
        <AppText style={[styles.grow, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </AppText>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={styles.list} accessibilityRole="radiogroup">
          {options.map(option => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
                style={[styles.option, active && styles.optionOn]}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <AppText style={styles.grow}>{option.label}</AppText>
                {active && <Check size={18} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
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
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  invalid: { borderColor: colors.error },
  disabled: { opacity: 0.5 },
  grow: { flex: 1 },
  placeholder: { color: colors.muted },
  list: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  optionOn: { backgroundColor: colors.primarySoft },
  error: { color: colors.error },
});
