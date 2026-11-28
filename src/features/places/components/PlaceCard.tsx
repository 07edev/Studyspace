import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Heart, MapPin, Star } from 'lucide-react-native';
import type { Place } from '../../../shared/contracts/places';
import { colors, radii } from '../../../shared/theme/tokens';
import { AppText, Chip } from '../../../shared/ui';
import { formatAddress, formatDistance, formatPriceRange, PLACE_CATEGORY_LABEL } from '../placeLabels';

export function PlaceCard({
  place,
  onPress,
  compact = false,
  trailing,
}: {
  place: Place;
  onPress: () => void;
  compact?: boolean;
  trailing?: React.ReactNode;
}) {
  const cover = place.images.find(i => i.isCover)?.url ?? place.images[0]?.url;
  const dist = formatDistance(place.distanceMeters);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem địa điểm ${place.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        pressed && styles.pressed,
      ]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={compact ? styles.coverCompact : styles.cover} accessibilityIgnoresInvertColors />
      ) : null}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Chip label={PLACE_CATEGORY_LABEL[place.category]} />
          <View style={styles.metaRight}>
            {place.openNow !== undefined && (
              <AppText variant="caption" style={place.openNow ? styles.open : styles.closed}>
                {place.openNow ? 'Đang mở' : 'Đóng cửa'}
              </AppText>
            )}
            {place.isFavorite && <Heart size={16} color={colors.error} fill={colors.error} />}
          </View>
        </View>

        <AppText variant="heading" numberOfLines={1}>
          {place.name}
        </AppText>

        <View style={styles.row}>
          <MapPin size={14} color={colors.muted} />
          <AppText variant="caption" muted numberOfLines={1} style={styles.grow}>
            {formatAddress(place.address)}
          </AppText>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.row}>
            <Star size={14} color={colors.primary} fill={colors.primary} />
            <AppText variant="caption">
              {place.ratingCount > 0 ? `${place.ratingAverage.toFixed(1)} (${place.ratingCount})` : 'Chưa có đánh giá'}
            </AppText>
            {dist ? <AppText variant="caption" muted>· {dist}</AppText> : null}
          </View>
          {!compact && place.price && (
            <AppText variant="caption" muted numberOfLines={1}>
              {formatPriceRange(place.price)}
            </AppText>
          )}
        </View>

        {trailing}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  compact: { width: 268 },
  pressed: { opacity: 0.78 },
  cover: { width: '100%', height: 140, backgroundColor: colors.primarySoft },
  coverCompact: { width: '100%', height: 112, backgroundColor: colors.primarySoft },
  body: { padding: 14, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  open: { color: colors.primary, fontWeight: '600' },
  closed: { color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerRow: { gap: 4 },
  grow: { flex: 1 },
});
