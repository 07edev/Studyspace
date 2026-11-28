import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import type { Place } from '../../shared/contracts/places';
import { queryKeys, usePagedQuery, useQueryClient } from '../../shared/query';
import { Button, PagedList, useToast } from '../../shared/ui';
import { PlaceCard } from '../places/components/PlaceCard';
import { placesApi } from '../places/placesApi';

// U18 - Danh sach dia diem yeu thich cua nguoi dung (thay pending feature 'favorites')
export function FavoritesModal() {
  const manager = useSessionManager();
  const queryClient = useQueryClient();
  const { open } = useModal();
  const toast = useToast();
  const api = useMemo(() => placesApi(manager), [manager]);
  const [removingId, setRemovingId] = useState<string>();

  const query = usePagedQuery<Place>(
    queryKeys.favorites.list(),
    '/users/me/favorites/places',
    {},
    { authenticated: true },
  );

  const onRemove = async (placeId: string) => {
    setRemovingId(placeId);
    try {
      await api.removeFavorite(placeId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
      ]);
      toast('Đã bỏ khỏi địa điểm yêu thích.');
    } catch {
      toast('Chưa bỏ lưu được. Vui lòng thử lại.');
    } finally {
      setRemovingId(undefined);
    }
  };

  return (
    <View style={styles.root}>
      <PagedList
        query={query}
        keyExtractor={item => item.id}
        emptyTitle="Chưa có địa điểm yêu thích"
        emptyDescription="Chạm biểu tượng Yêu thích trên trang chi tiết để lưu lại các góc học bạn thích."
        renderItem={place => (
          <PlaceCard
            place={{ ...place, isFavorite: true }}
            onPress={() => open({ name: 'place-detail', placeId: place.id })}
            trailing={
              <View style={styles.actions}>
                <Button
                  variant="ghost"
                  title="Bỏ lưu"
                  loading={removingId === place.id}
                  onPress={() => {
                    onRemove(place.id);
                  }}
                />
              </View>
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
});
