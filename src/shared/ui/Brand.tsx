import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';

export function Brand() {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <BookOpen size={21} color={colors.surface} strokeWidth={2} />
      </View>
      <AppText variant="heading">
        StudySpace
        <AppText variant="heading" style={styles.dot}>
          .
        </AppText>
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { color: colors.primary },
});
