import React, { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, Compass, Heart, MapPin, MessageSquarePlus, Star } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useAuthGate } from '../../shared/auth/AuthGate';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import type { Page } from '../../shared/contracts/api';
import type {
  AttributeDefinition,
  ImageRef,
  Place,
  PlaceCategory,
  PlaceFacets,
  QuietLevel,
  StudySuitability,
} from '../../shared/contracts/places';
import { queryKeys, useApiQuery, useQueryClient, withQuery } from '../../shared/query';
import { colors, radii } from '../../shared/theme/tokens';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
  SwitchRow,
  TextField,
  useToast,
} from '../../shared/ui';
import { PlaceCard } from './components/PlaceCard';
import { useExplore } from './ExploreContext';
import {
  DAY_OF_WEEK_LABEL,
  formatAddress,
  formatDistance,
  formatPriceRange,
  PLACE_CATEGORY_LABEL,
  PLACE_SORT_OPTIONS,
  QUIET_LEVEL_LABEL,
  STUDY_SUITABILITY_LABEL,
  type PlaceSort,
} from './placeLabels';
import { placesApi } from './placesApi';

const CATEGORY_LIST: PlaceCategory[] = ['CAFE', 'LIBRARY', 'COWORKING', 'STUDY_ROOM', 'OTHER'];
const QUIET_OPTIONS: { value: QuietLevel; label: string }[] = [
  { value: 'VERY_QUIET', label: QUIET_LEVEL_LABEL.VERY_QUIET },
  { value: 'QUIET', label: QUIET_LEVEL_LABEL.QUIET },
  { value: 'MODERATE', label: QUIET_LEVEL_LABEL.MODERATE },
  { value: 'NOISY', label: QUIET_LEVEL_LABEL.NOISY },
];
const SUITABILITY_OPTIONS: { value: StudySuitability; label: string }[] = [
  { value: 'SOLO', label: STUDY_SUITABILITY_LABEL.SOLO },
  { value: 'GROUP', label: STUDY_SUITABILITY_LABEL.GROUP },
  { value: 'BOTH', label: STUDY_SUITABILITY_LABEL.BOTH },
];

// U10 - Bo loc dia diem (facets + thuoc tinh dong)
export function PlaceFilterModal() {
  const { filters, patchFilters, resetFilters } = useExplore();
  const { close } = useModal();

  const [category, setCategory] = useState<PlaceCategory | undefined>(filters.category);
  const [amenities, setAmenities] = useState<string[]>(filters.amenities);
  const [quietLevel, setQuietLevel] = useState<QuietLevel | undefined>(filters.quietLevel);
  const [studySuitability, setStudySuitability] = useState<StudySuitability | undefined>(filters.studySuitability);
  const [openNow, setOpenNow] = useState(filters.openNow);
  const [minPrice, setMinPrice] = useState(filters.minPrice !== undefined ? String(filters.minPrice) : '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice !== undefined ? String(filters.maxPrice) : '');
  const [attrFilters, setAttrFilters] = useState<Record<string, string | number | boolean | string[]>>(
    filters.attributeFilters,
  );

  const facetsQuery = useApiQuery<PlaceFacets>(
    queryKeys.places.facets(category),
    withQuery('/places/facets', category ? { category } : {}),
    { authenticated: false },
  );
  const attrsQuery = useApiQuery<Page<AttributeDefinition>>(
    queryKeys.places.attributes(category),
    withQuery('/places/attribute-definitions', category ? { category, filterable: true } : { filterable: true }),
    { authenticated: false },
  );

  const toggleAmenity = (code: string) => {
    setAmenities(prev => (prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]));
  };

  const apply = () => {
    const min = minPrice.trim() !== '' && Number.isFinite(Number(minPrice)) ? Number(minPrice) : undefined;
    const max = maxPrice.trim() !== '' && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : undefined;
    patchFilters({
      category,
      amenities,
      quietLevel,
      studySuitability,
      openNow,
      minPrice: min,
      maxPrice: max,
      attributeFilters: attrFilters,
    });
    close();
  };

  const facetAmenities = facetsQuery.data?.amenities ?? [];
  const customAttrs = (attrsQuery.data?.items ?? facetsQuery.data?.customAttributes ?? []).filter(a => a.filterable && a.active);

  return (
    <View style={styles.section}>
      <View style={styles.group}>
        <AppText variant="label">Danh mục</AppText>
        <View style={styles.chips}>
          {CATEGORY_LIST.map(cat => (
            <Chip
              key={cat}
              label={PLACE_CATEGORY_LABEL[cat]}
              selected={category === cat}
              onPress={() => setCategory(prev => (prev === cat ? undefined : cat))}
            />
          ))}
        </View>
      </View>

      <SwitchRow
        label="Chỉ hiển thị nơi đang mở cửa"
        value={openNow}
        onValueChange={setOpenNow}
      />

      {facetAmenities.length > 0 && (
        <View style={styles.group}>
          <AppText variant="label">Tiện ích</AppText>
          <View style={styles.chips}>
            {facetAmenities.map(am => (
              <Chip
                key={am.value}
                label={`${am.label} (${am.count})`}
                selected={amenities.includes(am.value)}
                onPress={() => toggleAmenity(am.value)}
              />
            ))}
          </View>
        </View>
      )}

      <SelectField
        label="Độ yên tĩnh"
        value={quietLevel}
        options={QUIET_OPTIONS}
        placeholder="Bất kỳ"
        onChange={setQuietLevel}
      />

      <SelectField
        label="Phù hợp học tập"
        value={studySuitability}
        options={SUITABILITY_OPTIONS}
        placeholder="Bất kỳ"
        onChange={setStudySuitability}
      />

      <View style={styles.priceRow}>
        <View style={styles.grow}>
          <TextField
            label="Giá từ (VND)"
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
            placeholder="0"
          />
        </View>
        <View style={styles.grow}>
          <TextField
            label="Đến (VND)"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholder="100000"
          />
        </View>
      </View>

      {customAttrs.length > 0 && (
        <View style={styles.group}>
          <AppText variant="label">Thuộc tính bổ sung</AppText>
          {customAttrs.map(def => {
            const val = attrFilters[def.id];
            if (def.type === 'BOOLEAN') {
              return (
                <SwitchRow
                  key={def.id}
                  label={def.label}
                  value={Boolean(val)}
                  onValueChange={checked =>
                    setAttrFilters(prev => {
                      const next = { ...prev };
                      if (checked) {
                        next[def.id] = true;
                      } else {
                        delete next[def.id];
                      }
                      return next;
                    })
                  }
                />
              );
            }
            if (def.type === 'SINGLE_SELECT' && def.options && def.options.length > 0) {
              return (
                <SelectField
                  key={def.id}
                  label={def.label}
                  value={typeof val === 'string' ? val : undefined}
                  options={def.options.map(o => ({ value: o, label: o }))}
                  placeholder="Bất kỳ"
                  onChange={picked => setAttrFilters(prev => ({ ...prev, [def.id]: picked }))}
                />
              );
            }
            return null;
          })}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          variant="ghost"
          title="Đặt lại"
          onPress={() => {
            resetFilters();
            close();
          }}
        />
        <Button title="Áp dụng bộ lọc" onPress={apply} />
      </View>
    </View>
  );
}

// U11 - Sap xep ket qua (DISTANCE / RATING / UPDATED / POPULAR)
export function PlaceSortModal() {
  const { filters, patchFilters } = useExplore();
  const { close } = useModal();

  const pick = (sort: PlaceSort) => {
    patchFilters({ sort });
    close();
  };

  return (
    <View style={styles.section}>
      {PLACE_SORT_OPTIONS.map(opt => {
        const active = filters.sort === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            style={[styles.sortRow, active && styles.sortRowActive]}
            onPress={() => pick(opt.value)}
          >
            <View style={styles.grow}>
              <AppText variant="label">{opt.label}</AppText>
              <AppText variant="caption" muted>{opt.description}</AppText>
            </View>
            {active && <Check size={18} color={colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// U12 - The xem nhanh dia diem tu ban do
export function MapPlaceQuickModal({ placeId }: { placeId: string }) {
  const session = useSession();
  const { open, close } = useModal();
  const query = useApiQuery<Place>(
    queryKeys.places.detail(placeId),
    `/places/${placeId}`,
    { authenticated: session.status === 'authenticated' },
  );

  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError || !query.data) {
    return <ErrorState message={query.error?.message ?? 'Không tải được địa điểm.'} onRetry={() => query.refetch()} />;
  }
  const place = query.data;
  return (
    <View style={styles.section}>
      <PlaceCard place={place} onPress={() => open({ name: 'place-detail', placeId: place.id })} />
      <View style={styles.actions}>
        <Button
          variant="secondary"
          title="Chỉ đường"
          onPress={() =>
            Linking.openURL(
              `https://www.openstreetmap.org/directions?to=${place.location.lat},${place.location.lng}`,
            ).catch(() => undefined)
          }
        />
        <Button title="Xem chi tiết" onPress={() => open({ name: 'place-detail', placeId: place.id })} />
      </View>
      <Button variant="ghost" title="Đóng" onPress={close} />
    </View>
  );
}

// U13 - Chi tiet dia diem (thong tin day du, yeu thich optimistic+rollback, chi duong, danh gia, tuong tu)
export function PlaceDetailModal({ placeId }: { placeId: string }) {
  const session = useSession();
  const manager = useSessionManager();
  const queryClient = useQueryClient();
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  const toast = useToast();
  const api = useMemo(() => placesApi(manager), [manager]);

  const isAuth = session.status === 'authenticated';
  const query = useApiQuery<Place>(
    queryKeys.places.detail(placeId),
    `/places/${placeId}`,
    { authenticated: isAuth },
  );
  const similarQuery = useApiQuery<Page<Place>>(
    queryKeys.places.similar(placeId),
    `/places/${placeId}/similar`,
    { authenticated: false, enabled: query.isSuccess },
  );

  const [favOverride, setFavOverride] = useState<boolean>();
  const [favBusy, setFavBusy] = useState(false);

  if (query.isPending) {
    return <LoadingState label="Đang tải chi tiết địa điểm…" />;
  }
  if (query.isError || !query.data) {
    return <ErrorState message={query.error?.message ?? 'Không tải được chi tiết địa điểm.'} onRetry={() => query.refetch()} />;
  }

  const place = query.data;
  const isFav = favOverride ?? Boolean(place.isFavorite);
  const dist = formatDistance(place.distanceMeters);

  const runToggleFavorite = async () => {
    if (favBusy) {
      return;
    }
    const next = !isFav;
    setFavBusy(true);
    setFavOverride(next);
    try {
      if (next) {
        await api.addFavorite(place.id);
        toast('Đã lưu vào địa điểm yêu thích.');
      } else {
        await api.removeFavorite(place.id);
        toast('Đã bỏ khỏi địa điểm yêu thích.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all }),
      ]);
    } catch {
      // Optimistic rollback
      setFavOverride(!next);
      toast('Chưa cập nhật được trạng thái yêu thích. Vui lòng thử lại.');
    } finally {
      setFavBusy(false);
    }
  };

  const onPressFavorite = () => {
    requireAuth({
      reason: 'Đăng nhập để lưu địa điểm yêu thích của bạn.',
      action: runToggleFavorite,
    });
  };

  return (
    <View style={styles.section}>
      {place.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
          {place.images.map((img, idx) => (
            <Pressable
              key={img.fileId}
              accessibilityRole="button"
              accessibilityLabel={`Xem ảnh ${idx + 1}`}
              onPress={() => open({ name: 'photo-gallery', placeId: place.id, images: place.images, initialIndex: idx })}
            >
              {img.url ? (
                <Image source={{ uri: img.url }} style={styles.galleryThumb} accessibilityIgnoresInvertColors />
              ) : (
                <View style={[styles.galleryThumb, styles.galleryPlaceholder]}>
                  <AppText variant="caption" muted>Ảnh #{idx + 1}</AppText>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.chips}>
        <Chip label={PLACE_CATEGORY_LABEL[place.category]} />
        {place.openNow !== undefined && (
          <Chip label={place.openNow ? 'Đang mở cửa' : 'Đang đóng cửa'} selected={place.openNow} />
        )}
        <Chip label={QUIET_LEVEL_LABEL[place.quietLevel]} />
        <Chip label={STUDY_SUITABILITY_LABEL[place.studySuitability]} />
      </View>

      <View style={styles.group}>
        <AppText variant="title">{place.name}</AppText>
        <View style={styles.inlineRow}>
          <Star size={16} color={colors.primary} fill={colors.primary} />
          <AppText variant="label">
            {place.ratingCount > 0 ? `${place.ratingAverage.toFixed(1)} (${place.ratingCount} đánh giá)` : 'Chưa có đánh giá'}
          </AppText>
          {dist ? <AppText muted>· {dist}</AppText> : null}
        </View>
        <View style={styles.inlineRow}>
          <MapPin size={16} color={colors.muted} />
          <AppText muted style={styles.grow}>{formatAddress(place.address)}</AppText>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <Button
          variant={isFav ? 'primary' : 'secondary'}
          title={isFav ? 'Đã yêu thích' : 'Yêu thích'}
          loading={favBusy}
          onPress={onPressFavorite}
        />
        <Button
          variant="secondary"
          title="Chỉ đường"
          onPress={() =>
            Linking.openURL(
              `https://www.openstreetmap.org/directions?to=${place.location.lat},${place.location.lng}`,
            ).catch(() => undefined)
          }
        />
      </View>

      <Card style={styles.infoCard}>
        <AppText variant="heading">Thông tin chung</AppText>
        <AppText>Khoảng giá: {formatPriceRange(place.price)}</AppText>
        {place.phone ? <AppText>Điện thoại: {place.phone}</AppText> : null}
        {place.website ? <AppText>Website: {place.website}</AppText> : null}
        {place.description ? <AppText muted>{place.description}</AppText> : null}
      </Card>

      {place.amenities.length > 0 && (
        <Card style={styles.infoCard}>
          <AppText variant="heading">Tiện ích</AppText>
          <View style={styles.chips}>
            {place.amenities.map(code => (
              <Chip key={code} label={code} />
            ))}
          </View>
        </Card>
      )}

      {place.hours.length > 0 && (
        <Card style={styles.infoCard}>
          <AppText variant="heading">Giờ mở cửa (giờ VN)</AppText>
          {place.hours.map(d => (
            <View style={styles.rowBetween} key={d.day}>
              <AppText variant="label">{DAY_OF_WEEK_LABEL[d.day]}</AppText>
              <AppText muted>
                {d.closed
                  ? 'Đóng cửa'
                  : d.intervals.map(iv => `${iv.open}–${iv.close}${iv.overnight ? ' (+1)' : ''}`).join(', ')}
              </AppText>
            </View>
          ))}
        </Card>
      )}

      <View style={styles.group}>
        <Button
          variant="secondary"
          title={`Xem đánh giá (${place.ratingCount})`}
          onPress={() => open({ name: 'place-reviews', placeId: place.id, placeName: place.name })}
        />
        <Button
          variant="ghost"
          title="Gợi ý chỉnh sửa thông tin địa điểm"
          onPress={() =>
            requireAuth({
              reason: 'Đăng nhập để gửi gợi ý cập nhật thông tin địa điểm.',
              action: () => open({ name: 'suggestion-update', place }),
            })
          }
        />
      </View>

      {(similarQuery.data?.items.length ?? 0) > 0 && (
        <View style={styles.group}>
          <AppText variant="heading">Địa điểm tương tự</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {similarQuery.data!.items.map(sim => (
              <PlaceCard
                key={sim.id}
                place={sim}
                compact
                onPress={() => open({ name: 'place-detail', placeId: sim.id })}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.iconHints} accessible={false}>
        <Heart size={1} color="transparent" />
        <Compass size={1} color="transparent" />
        <MessageSquarePlus size={1} color="transparent" />
      </View>
    </View>
  );
}

// U14 - Xem thu vien anh full-screen
export function PhotoGalleryModal({
  placeId,
  images,
  initialIndex = 0,
}: {
  placeId: string;
  images: ImageRef[];
  initialIndex?: number;
}) {
  const { open } = useModal();
  const [index, setIndex] = useState(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));

  if (images.length === 0) {
    return (
      <EmptyState
        title="Chưa có hình ảnh"
        description="Địa điểm này chưa có hình ảnh để phóng to."
      />
    );
  }
  const current = images[index];

  return (
    <View style={styles.section}>
      <AppText variant="caption" muted>
        Ảnh {index + 1} / {images.length}
      </AppText>
      {current.url ? (
        <Image source={{ uri: current.url }} style={styles.fullPhoto} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.fullPhoto, styles.galleryPlaceholder]}>
          <AppText muted>{current.alt ?? current.fileId}</AppText>
        </View>
      )}
      {current.alt ? <AppText muted>{current.alt}</AppText> : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          title="Ảnh trước"
          disabled={index <= 0}
          onPress={() => setIndex(i => Math.max(0, i - 1))}
        />
        <Button
          variant="secondary"
          title="Ảnh sau"
          disabled={index >= images.length - 1}
          onPress={() => setIndex(i => Math.min(images.length - 1, i + 1))}
        />
      </View>
      <Button variant="ghost" title="Quay lại chi tiết địa điểm" onPress={() => open({ name: 'place-detail', placeId })} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceRow: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  actionGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  sortRow: {
    padding: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  infoCard: { gap: 8 },
  galleryRow: { gap: 10 },
  galleryThumb: { width: 150, height: 108, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  galleryPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  fullPhoto: { width: '100%', height: 320, borderRadius: radii.md, backgroundColor: colors.surface },
  iconHints: { height: 0, overflow: 'hidden' },
});
