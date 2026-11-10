import React, { type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/tokens';
import type { PagedQuery } from '../query/useApiQuery';
import { AppText } from './AppText';
import { Button } from './Button';
import { EmptyState, ErrorState, LoadingState } from './States';

type Props<T> = {
  query: PagedQuery<T>;
  renderItem: (item: T, index: number) => ReactElement;
  keyExtractor: (item: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  header?: ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * A screen-level list with every state handled the same way across the app:
 * first load, error (with retry), empty, pull-to-refresh, load-more on scroll and "next page failed".
 * Feed it with usePagedQuery(). Do not nest it inside another vertical ScrollView.
 */
export function PagedList<T>({
  query,
  renderItem,
  keyExtractor,
  emptyTitle = 'Chưa có nội dung',
  emptyDescription = 'Khi có dữ liệu, nội dung sẽ hiện ở đây.',
  header,
  contentContainerStyle,
}: Props<T>) {
  if (query.status === 'loading') {
    return <LoadingState />;
  }
  if (query.status === 'error') {
    return <ErrorState message={query.error?.message ?? 'Đã có lỗi xảy ra.'} onRetry={query.retry} />;
  }
  return (
    <FlatList
      data={query.items}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => renderItem(item, index)}
      ListHeaderComponent={header}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      onEndReachedThreshold={0.4}
      onEndReached={query.fetchNext}
      refreshControl={<RefreshControl refreshing={query.isRefreshing} onRefresh={query.refresh} />}
      ListEmptyComponent={<EmptyState title={emptyTitle} description={emptyDescription} />}
      ListFooterComponent={
        query.isFetchingNext ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Đang tải thêm" style={styles.footer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : query.nextFailed ? (
          <View style={styles.footer}>
            <AppText muted>Chưa tải thêm được.</AppText>
            <Button variant="secondary" title="Thử lại" onPress={query.fetchNext} />
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12, flexGrow: 1 },
  footer: { paddingVertical: 16, alignItems: 'center', gap: 12 },
});
