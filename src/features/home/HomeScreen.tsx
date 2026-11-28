import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Compass,
  MapPin,
  PlusCircle,
  Search,
  Users,
} from 'lucide-react-native';
import type { AppTabParamList } from '../../navigation/types';
import { useModal } from '../../navigation/ModalCoordinator';
import { useAuthGate } from '../../shared/auth/AuthGate';
import { useSession } from '../../shared/auth/AuthProvider';
import type { Page } from '../../shared/contracts/api';
import type { Homepage, Place, PlaceCategory, TaxonomyItem } from '../../shared/contracts/places';
import { queryKeys, useApiQuery, withQuery } from '../../shared/query';
import { colors } from '../../shared/theme/tokens';
import { AppText, Button, Card, Chip, ErrorState, LoadingState, Screen } from '../../shared/ui';
import { Brand } from '../../shared/ui/Brand';
import { PlaceCard } from '../places/components/PlaceCard';
import { useExplore } from '../places/ExploreContext';
import { StudyIllustration } from '../welcome/StudyIllustration';

const shortcuts = [
  {
    route: 'Explore',
    title: 'Tìm nơi học',
    text: 'Một góc thật hợp bạn',
    Icon: Compass,
  },
  {
    route: 'Community',
    title: 'Cộng đồng',
    text: 'Chia sẻ và kết nối',
    Icon: Users,
  },
  {
    route: 'Documents',
    title: 'Tài liệu',
    text: 'Thêm kiến thức mới',
    Icon: BookOpen,
  },
] as const;

// USR-07 - Trang chu (chon khu vuc U09, danh muc, gan ban, danh gia cao, moi cap nhat, de xuat dia diem)
export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  const session = useSession();
  const { location, patchFilters } = useExplore();

  const isAuth = session.status === 'authenticated';
  const homeParams = location.coords ? { lat: location.coords.lat, lng: location.coords.lng } : {};
  const homeQuery = useApiQuery<Homepage>(
    queryKeys.places.home(homeParams),
    withQuery('/home', homeParams),
    { authenticated: isAuth },
  );
  const categoriesQuery = useApiQuery<Page<TaxonomyItem>>(
    queryKeys.taxonomy.categories(),
    '/taxonomies/place-categories',
    { authenticated: false },
  );

  const categories = categoriesQuery.data?.items.length
    ? categoriesQuery.data.items
    : homeQuery.data?.categories ?? [];

  const openCategory = (code: string) => {
    patchFilters({ category: code as PlaceCategory });
    navigation.navigate('Explore');
  };

  const renderSection = (title: string, subtitle: string, items: Place[]) => {
    if (items.length === 0) {
      return null;
    }
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.section}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="caption" muted>{subtitle}</AppText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {items.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
              compact
              onPress={() => open({ name: 'place-detail', placeId: place.id })}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          style={styles.iconButton}
          onPress={() =>
            requireAuth({
              reason: 'Đăng nhập để xem thông báo dành cho bạn.',
              action: () => open({ name: 'feature', feature: 'notifications' }),
            })
          }
        >
          <Bell size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.heading}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn khu vực"
          style={styles.locationPill}
          onPress={() => open({ name: 'location-picker' })}
        >
          <MapPin size={15} color={colors.primary} />
          <AppText variant="caption" style={styles.kicker}>
            {location.wardName
              ? `${location.wardName}, ${location.provinceName}`
              : location.provinceName ?? 'CHỌN KHU VỰC HỌC TẬP'}
          </AppText>
        </Pressable>
        <AppText variant="title">Một góc học,{'\n'}nhiều cảm hứng.</AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Khám phá địa điểm học tập"
        style={styles.search}
        onPress={() => navigation.navigate('Explore')}
      >
        <Search size={21} color={colors.muted} />
        <AppText muted style={styles.grow}>
          Tìm không gian học tập
        </AppText>
        <ArrowUpRight size={20} color={colors.primary} />
      </Pressable>

      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {categories.map(cat => (
            <Chip key={cat.id} label={cat.name} onPress={() => openCategory(cat.code)} />
          ))}
        </ScrollView>
      )}

      {homeQuery.isPending && <LoadingState label="Đang gợi ý không gian học tập…" />}
      {homeQuery.isError && (
        <ErrorState
          message={homeQuery.error?.message ?? 'Chưa tải được danh sách địa điểm gợi ý.'}
          onRetry={() => homeQuery.refetch()}
        />
      )}
      {homeQuery.data && (
        <>
          {renderSection('Gần bạn', 'Các điểm học tập thuận tiện di chuyển', homeQuery.data.nearby)}
          {renderSection('Đánh giá cao', 'Được cộng đồng sinh viên yêu thích nhất', homeQuery.data.topRated)}
          {renderSection('Mới cập nhật', 'Không gian vừa làm mới thông tin', homeQuery.data.recentlyUpdated)}
        </>
      )}

      <Card style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="heading">Không gian cho{'\n'}ý tưởng lớn.</AppText>
          <AppText muted>Biết một góc học hay chưa có trên bản đồ? Đóng góp ngay.</AppText>
          <Button
            variant="secondary"
            title="Đề xuất địa điểm mới"
            onPress={() =>
              requireAuth({
                reason: 'Đăng nhập để đề xuất địa điểm học tập mới.',
                action: () => open({ name: 'suggestion-create' }),
              })
            }
          />
        </View>
        <StudyIllustration />
      </Card>

      <View style={styles.section}>
        <AppText variant="heading">Bắt đầu từ đây</AppText>
        <AppText variant="caption" muted>
          Khám phá StudySpace theo cách của bạn.
        </AppText>
      </View>
      <View style={styles.shortcuts}>
        {shortcuts.map(({ route, title, text, Icon }) => (
          <Pressable
            key={route}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => navigation.navigate(route)}
            style={({ pressed }) => [
              styles.shortcut,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.shortcutIcon}>
              <Icon size={23} color={colors.primary} />
            </View>
            <View style={styles.grow}>
              <AppText variant="label">{title}</AppText>
              <AppText variant="caption" muted>
                {text}
              </AppText>
            </View>
            <ArrowUpRight size={19} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <View style={styles.iconKeep} accessible={false}>
        <PlusCircle size={1} color="transparent" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: { gap: 9 },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  kicker: { color: colors.primary, fontWeight: '600', letterSpacing: 0.5 },
  search: {
    minHeight: 56,
    padding: 16,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chips: { gap: 8, paddingVertical: 2 },
  sectionBlock: { gap: 10 },
  horizontalList: { gap: 12 },
  grow: { flex: 1 },
  hero: {
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  heroCopy: { gap: 10 },
  section: { gap: 4 },
  shortcuts: { gap: 12 },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutIcon: {
    padding: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
  },
  pressed: { opacity: 0.7 },
  iconKeep: { height: 0, overflow: 'hidden' },
});
