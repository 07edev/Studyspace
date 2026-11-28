import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpDown, List, Map as MapIcon, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSession } from '../../shared/auth/AuthProvider';
import type { Page } from '../../shared/contracts/api';
import type { Place, PlaceCategory, PlaceMapFeature } from '../../shared/contracts/places';
import { queryKeys, useApiQuery, usePagedQuery, withQuery } from '../../shared/query';
import { colors, radii } from '../../shared/theme/tokens';
import { AppText, Chip, ErrorState, LoadingState, PagedList, TextField } from '../../shared/ui';
import { MapCanvas } from '../places/components/MapCanvas';
import { PlaceCard } from '../places/components/PlaceCard';
import { useExplore } from '../places/ExploreContext';
import { PLACE_CATEGORY_LABEL } from '../places/placeLabels';

const CATEGORIES: PlaceCategory[] = ['CAFE', 'LIBRARY', 'COWORKING', 'STUDY_ROOM', 'OTHER'];
const DEFAULT_BBOX = '106.62,10.72,106.78,10.84';

// USR-08 - Kham pha dia diem (Danh sach PagedList + Ban do WebView Leaflet OSM + U09/U10/U11/U12/U13)
export function ExploreScreen() {
  const session = useSession();
  const { open } = useModal();
  const { location, filters, patchFilters, activeFilterCount } = useExplore();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [bbox, setBbox] = useState(DEFAULT_BBOX);

  const isAuth = session.status === 'authenticated';
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {
      sort: filters.sort,
    };
    if (filters.q.trim()) {
      params.q = filters.q.trim();
    }
    if (filters.category) {
      params.category = filters.category;
    }
    if (location.provinceCode) {
      params.provinceCode = location.provinceCode;
    }
    if (location.coords) {
      params.lat = location.coords.lat;
      params.lng = location.coords.lng;
    }
    if (filters.amenities.length > 0) {
      params.amenities = filters.amenities.join(',');
    }
    if (filters.quietLevel) {
      params.quietLevel = filters.quietLevel;
    }
    if (filters.studySuitability) {
      params.studySuitability = filters.studySuitability;
    }
    if (filters.openNow) {
      params.openNow = true;
    }
    if (filters.minPrice !== undefined) {
      params.minPrice = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      params.maxPrice = filters.maxPrice;
    }
    if (Object.keys(filters.attributeFilters).length > 0) {
      params.attributeFilters = JSON.stringify(filters.attributeFilters);
    }
    return params;
  }, [filters, location]);

  const listQuery = usePagedQuery<Place>(
    queryKeys.places.list(queryParams),
    '/places',
    queryParams,
    { authenticated: isAuth, enabled: viewMode === 'list' },
  );

  const mapParams = useMemo(
    () => ({
      bbox,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.amenities.length > 0 ? { amenities: filters.amenities.join(',') } : {}),
      limit: 100,
    }),
    [bbox, filters.category, filters.amenities],
  );
  const mapQuery = useApiQuery<Page<PlaceMapFeature>>(
    queryKeys.places.map(mapParams),
    withQuery('/places/map', mapParams),
    { authenticated: false, enabled: viewMode === 'map' },
  );

  const headerControls = (
    <View style={styles.controls}>
      <View style={styles.titleRow}>
        <View style={styles.grow}>
          <AppText variant="title">Khám phá</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn khu vực tìm kiếm"
            style={styles.locationBtn}
            onPress={() => open({ name: 'location-picker' })}
          >
            <MapPin size={14} color={colors.primary} />
            <AppText variant="caption" style={styles.locationText}>
              {location.wardName
                ? `${location.wardName}, ${location.provinceName}`
                : location.provinceName ?? 'Toàn quốc · Chọn khu vực'}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.modeToggle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chế độ danh sách"
            accessibilityState={{ selected: viewMode === 'list' }}
            style={[styles.modeBtn, viewMode === 'list' && styles.modeBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={18} color={viewMode === 'list' ? colors.surface : colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chế độ bản đồ"
            accessibilityState={{ selected: viewMode === 'map' }}
            style={[styles.modeBtn, viewMode === 'map' && styles.modeBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <MapIcon size={18} color={viewMode === 'map' ? colors.surface : colors.ink} />
          </Pressable>
        </View>
      </View>

      <TextField
        label="Tìm không gian học tập"
        value={filters.q}
        onChangeText={q => patchFilters({ q })}
        placeholder="Nhập tên quán, thư viện hoặc tên đường…"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={activeFilterCount > 0 ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'}
          selected={activeFilterCount > 0}
          onPress={() => open({ name: 'place-filter' })}
        />
        <Chip label="Sắp xếp" onPress={() => open({ name: 'place-sort' })} />
        <Chip
          label="Đang mở"
          selected={filters.openNow}
          onPress={() => patchFilters({ openNow: !filters.openNow })}
        />
        {CATEGORIES.map(cat => (
          <Chip
            key={cat}
            label={PLACE_CATEGORY_LABEL[cat]}
            selected={filters.category === cat}
            onPress={() => patchFilters({ category: filters.category === cat ? undefined : cat })}
          />
        ))}
      </ScrollView>

      <View style={styles.iconKeep} accessible={false}>
        <SlidersHorizontal size={1} color="transparent" />
        <ArrowUpDown size={1} color="transparent" />
      </View>
    </View>
  );

  if (viewMode === 'map') {
    const tooLarge = mapQuery.error?.code === 'MAP_BOUNDS_TOO_LARGE';
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.mapScreen}>
          {headerControls}
          {tooLarge && (
            <View style={styles.warnBanner}>
              <AppText variant="caption" style={styles.warnText}>
                Vùng bản đồ đang quá rộng. Hãy phóng to bản đồ để xem các địa điểm học tập.
              </AppText>
            </View>
          )}
          {mapQuery.isPending && <LoadingState label="Đang tải ghim trên bản đồ…" />}
          {mapQuery.isError && !tooLarge && (
            <ErrorState message={mapQuery.error?.message ?? 'Không tải được dữ liệu bản đồ.'} onRetry={() => mapQuery.refetch()} />
          )}
          <MapCanvas
            center={location.coords}
            markers={mapQuery.data?.items ?? []}
            height={380}
            onBoundsChange={setBbox}
            onMarkerPress={placeId => open({ name: 'map-place-quick', placeId })}
          />
          <AppText variant="caption" muted>
            {mapQuery.data ? `Hiển thị ${mapQuery.data.items.length} địa điểm trong vùng bản đồ.` : 'Chạm vào ghim để xem nhanh.'}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <PagedList
        query={listQuery}
        header={headerControls}
        keyExtractor={item => item.id}
        emptyTitle="Chưa tìm thấy địa điểm phù hợp"
        emptyDescription="Thử đổi từ khóa, chọn khu vực khác hoặc bớt bộ lọc."
        renderItem={place => (
          <PlaceCard
            place={place}
            onPress={() => open({ name: 'place-detail', placeId: place.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { gap: 12, paddingBottom: 8 },
  mapScreen: { flex: 1, padding: 20, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  grow: { flex: 1, gap: 4 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  locationText: { color: colors.primary, fontWeight: '600' },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  modeBtn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' },
  modeBtnActive: { backgroundColor: colors.primary },
  chips: { gap: 8, paddingVertical: 2 },
  warnBanner: {
    padding: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  warnText: { color: colors.primary },
  iconKeep: { height: 0, overflow: 'hidden' },
});
