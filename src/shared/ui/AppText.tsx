import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors } from '../theme/tokens';

type Props = TextProps & {
  variant?: 'hero' | 'title' | 'heading' | 'body' | 'caption' | 'label';
  muted?: boolean;
};
export function AppText({ variant = 'body', muted, style, ...props }: Props) {
  return (
    <Text
      {...props}
      style={[styles.base, styles[variant], muted && styles.muted, style]}
    />
  );
}
const styles = StyleSheet.create({
  base: { color: colors.ink },
  hero: {
    fontSize: 36,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  heading: { fontSize: 19, lineHeight: 27, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  caption: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  muted: { color: colors.muted },
});
