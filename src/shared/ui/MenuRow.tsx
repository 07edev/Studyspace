import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';

// A rounded group of tappable rows (Cá nhân, Cài đặt...). Put MenuRow children inside MenuGroup.
export function MenuGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

type RowProps = {
  label: string;
  onPress: () => void;
  Icon?: LucideIcon;
  // Small text on the right (e.g. current value). Pass `chevron={false}` to hide the arrow.
  value?: string;
  chevron?: boolean;
  testID?: string;
};

export function MenuRow({ label, onPress, Icon, value, chevron = true, testID }: RowProps) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} style={styles.row} onPress={onPress}>
      {Icon ? <Icon size={21} color={colors.primary} /> : null}
      <AppText style={styles.grow}>{label}</AppText>
      {value ? (
        <AppText variant="caption" muted>
          {value}
        </AppText>
      ) : null}
      {chevron ? <ChevronRight size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12, minHeight: 60 },
  grow: { flex: 1 },
});
