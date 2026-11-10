import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { AppText } from './AppText';

type Props = {
  // PublicAuthor.avatarUrl / Profile.avatarUrl. Falls back to initials, then to a person icon.
  uri?: string;
  name?: string;
  size?: number;
};

const initialsOf = (name?: string) => {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return `${first}${last}`.toLocaleUpperCase('vi');
};

export function Avatar({ uri, name, size = 48 }: Props) {
  const shape = { width: size, height: size, borderRadius: size * 0.34 };
  const initials = initialsOf(name);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `Ảnh đại diện của ${name}` : 'Ảnh đại diện'}
      style={[styles.base, shape]}
    >
      {uri ? (
        <Image source={{ uri }} style={shape} accessibilityIgnoresInvertColors />
      ) : initials ? (
        <AppText style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</AppText>
      ) : (
        <UserRound size={size * 0.46} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { color: colors.primary, fontWeight: '700' },
});
