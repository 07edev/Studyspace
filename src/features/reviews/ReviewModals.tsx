import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useAuthGate } from '../../shared/auth/AuthGate';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import type { Review } from '../../shared/contracts/places';
import { queryKeys, usePagedQuery, useQueryClient } from '../../shared/query';
import { colors, radii } from '../../shared/theme/tokens';
import {
  AppText,
  Button,
  Card,
  Chip,
  PagedList,
  TextField,
  useConfirm,
  useToast,
} from '../../shared/ui';
import { useDirtyGuard, useSubmit } from '../auth/formHooks';
import { placesApi } from '../places/placesApi';

type ReviewSort = 'newest' | 'highest' | 'lowest' | 'oldest';
const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'highest', label: 'Cao nhất' },
  { value: 'lowest', label: 'Thấp nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

// U15 - Danh sach danh gia cua dia diem (+ U17 xoa danh gia qua useConfirm, tab Danh gia cua toi)
export function PlaceReviewsModal({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName?: string;
}) {
  const session = useSession();
  const manager = useSessionManager();
  const queryClient = useQueryClient();
  const { open } = useModal();
  const { requireAuth } = useAuthGate();
  const confirm = useConfirm();
  const toast = useToast();
  const api = useMemo(() => placesApi(manager), [manager]);

  const [tab, setTab] = useState<'place' | 'mine'>('place');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const isAuth = session.status === 'authenticated';
  const myUserId = session.user?.id;

  const placeReviewsQuery = usePagedQuery<Review>(
    queryKeys.places.reviews(placeId, sort),
    `/places/${placeId}/reviews`,
    { sort },
    { authenticated: false, enabled: tab === 'place' },
  );

  const myReviewsQuery = usePagedQuery<Review>(
    queryKeys.reviews.mine(),
    '/users/me/reviews',
    {},
    { authenticated: true, enabled: tab === 'mine' && isAuth },
  );

  const onDelete = async (review: Review) => {
    const ok = await confirm({
      title: 'Xóa đánh giá?',
      message: 'Đánh giá này sẽ bị xóa khỏi địa điểm và điểm trung bình sẽ được tính lại.',
      confirmLabel: 'Xóa đánh giá',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await api.deleteReview(review.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
      ]);
      toast('Đã xóa đánh giá.');
    } catch {
      toast('Chưa xóa được đánh giá. Vui lòng thử lại.');
    }
  };

  const openWrite = () => {
    requireAuth({
      reason: 'Đăng nhập để viết đánh giá cho địa điểm này.',
      action: () => open({ name: 'review-form', placeId, placeName }),
    });
  };

  const activeQuery = tab === 'place' ? placeReviewsQuery : myReviewsQuery;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.rowBetween}>
          <View style={styles.chips}>
            <Chip
              label="Đánh giá địa điểm"
              selected={tab === 'place'}
              onPress={() => setTab('place')}
            />
            {isAuth && (
              <Chip
                label="Đánh giá của tôi"
                selected={tab === 'mine'}
                onPress={() => setTab('mine')}
              />
            )}
          </View>
        </View>
        {tab === 'place' && (
          <View style={styles.chips}>
            {SORTS.map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                selected={sort === opt.value}
                onPress={() => setSort(opt.value)}
              />
            ))}
          </View>
        )}
        <View style={styles.rowBetween}>
          <Button
            variant="ghost"
            title="← Về chi tiết địa điểm"
            onPress={() => open({ name: 'place-detail', placeId })}
          />
          <Button title="Viết đánh giá" onPress={openWrite} />
        </View>
      </View>

      <PagedList
        query={activeQuery}
        keyExtractor={item => item.id}
        emptyTitle="Chưa có đánh giá nào"
        emptyDescription="Hãy là người đầu tiên chia sẻ trải nghiệm học tập tại đây."
        renderItem={review => {
          const mine = Boolean(myUserId && review.author.id === myUserId);
          return (
            <Card style={styles.reviewCard}>
              <View style={styles.rowBetween}>
                <AppText variant="label">{review.author.displayName}</AppText>
                <View style={styles.starRow}>
                  <Star size={14} color={colors.primary} fill={colors.primary} />
                  <AppText variant="label">{review.rating}/5</AppText>
                </View>
              </View>
              {tab === 'mine' && review.placeName ? (
                <AppText variant="caption" muted>{review.placeName}</AppText>
              ) : null}
              {review.content ? <AppText>{review.content}</AppText> : null}
              <AppText variant="caption" muted>
                {new Date(review.createdAt).toLocaleDateString('vi-VN')}
              </AppText>
              {mine && (
                <View style={styles.actions}>
                  <Button
                    variant="secondary"
                    title="Sửa đánh giá"
                    onPress={() =>
                      open({ name: 'review-form', placeId: review.placeId, placeName, existing: review })
                    }
                  />
                  <Button
                    variant="danger"
                    title="Xóa"
                    onPress={() => {
                      onDelete(review);
                    }}
                  />
                </View>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

// U16 - Form tao / chinh sua danh gia (1-5 sao + noi dung + dirty guard)
export function ReviewFormModal({
  placeId,
  placeName,
  existing,
}: {
  placeId: string;
  placeName?: string;
  existing?: Review;
}) {
  const manager = useSessionManager();
  const queryClient = useQueryClient();
  const { open, setDirty } = useModal();
  const toast = useToast();
  const submit = useSubmit();
  const api = useMemo(() => placesApi(manager), [manager]);

  const initialRating = existing?.rating ?? 5;
  const initialContent = existing?.content ?? '';
  const [rating, setRating] = useState(initialRating);
  const [content, setContent] = useState(initialContent);
  const [localError, setLocalError] = useState<string>();

  const isDirty = rating !== initialRating || content !== initialContent;
  useDirtyGuard(isDirty);

  const onSave = async () => {
    if (rating < 1 || rating > 5) {
      setLocalError('Vui lòng chọn từ 1 đến 5 sao.');
      return;
    }
    if (content.trim().length > 2000) {
      setLocalError('Nội dung đánh giá tối đa 2000 ký tự.');
      return;
    }
    setLocalError(undefined);
    const payload = {
      rating,
      ...(content.trim() ? { content: content.trim() } : {}),
    };
    const saved = await submit.run(() =>
      existing
        ? api.updateReview(existing.id, payload)
        : api.createReview(placeId, payload),
    );
    if (saved) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
      ]);
      setDirty(false);
      toast(existing ? 'Đã cập nhật đánh giá.' : 'Cảm ơn bạn đã gửi đánh giá.');
      open({ name: 'place-reviews', placeId, placeName });
    }
  };

  return (
    <View style={styles.form}>
      {placeName ? <AppText muted>Địa điểm: {placeName}</AppText> : null}

      <View style={styles.group}>
        <AppText variant="label">Đánh giá của bạn ({rating}/5 sao)</AppText>
        <View style={styles.starsPicker}>
          {[1, 2, 3, 4, 5].map(n => {
            const filled = n <= rating;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`${n} sao`}
                accessibilityState={{ selected: n === rating }}
                style={[styles.starBtn, filled && styles.starBtnActive]}
                onPress={() => setRating(n)}
              >
                <Star
                  size={22}
                  color={filled ? colors.primary : colors.muted}
                  fill={filled ? colors.primary : 'transparent'}
                />
                <AppText variant="caption">{n}</AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField
        label="Chia sẻ trải nghiệm học tập"
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        style={styles.textarea}
        placeholder="Wi-Fi, ổ cắm, độ yên tĩnh, ánh sáng, chỗ ngồi…"
        hint={`${content.trim().length}/2000 ký tự`}
        error={localError ?? submit.fields.content ?? submit.fields.rating}
      />

      {submit.message ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {submit.message}
        </AppText>
      ) : null}

      <Button
        title={existing ? 'Lưu thay đổi' : 'Gửi đánh giá'}
        loading={submit.pending}
        onPress={onSave}
      />
      <Button
        variant="ghost"
        title="Quay lại danh sách đánh giá"
        onPress={() => {
          setDirty(false);
          open({ name: 'place-reviews', placeId, placeName });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewCard: { gap: 8 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  form: { gap: 16 },
  group: { gap: 8 },
  starsPicker: { flexDirection: 'row', gap: 8 },
  starBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  starBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  textarea: { minHeight: 120 },
  error: { color: colors.error },
});
