import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

// A labelled on/off row. The whole row reads as one control for screen readers.
export function SwitchRow({ label, description, value, onValueChange, disabled, testID }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText>{label}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 },
  text: { flex: 1, gap: 2 },
});
