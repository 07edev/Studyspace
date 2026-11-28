import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Review } from '@contracts/places';
import { body, makeAdmin, mockApi, ok, page, renderApp, resetApi, signedIn, superAdmin } from '../../test/helpers';

afterEach(resetApi);

const makeReview = (overrides: Partial<Review> = {}): Review => ({
  id: '65f000000000000000000071',
  placeId: '65f000000000000000000011',
  placeName: 'The Study Hub Q1',
  author: { id: 'u9', displayName: 'Lan Sinh Viên' },
  rating: 4,
  content: 'Không gian thoáng mát, wifi ổn định.',
  status: 'PUBLISHED',
  createdAt: '2026-02-05T12:00:00.000Z',
  ...overrides,
});

describe('Reviews moderation (ADM-15)', () => {
  it('lists reviews, opens A32 detail modal, and hides review via A33', async () => {
    const review = makeReview();
    const modBodies: unknown[] = [];
    mockApi({
      ...signedIn(superAdmin()),
      'GET /admin/reviews': () => ok(page([review])),
      [`GET /admin/reviews/${review.id}`]: () => ok(review),
      [`PATCH /admin/reviews/${review.id}/moderation`]: (_url, init) => {
        modBodies.push(body(init));
        return ok({ ...review, status: 'HIDDEN' });
      },
    });

    renderApp('/reviews');
    expect(await screen.findByText('Lan Sinh Viên')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `Chi tiết đánh giá ${review.id}` }));
    const detailDialog = await screen.findByRole('dialog');
    expect(within(detailDialog).getByText('Không gian thoáng mát, wifi ổn định.')).toBeInTheDocument();
    await user.click(within(detailDialog).getAllByRole('button', { name: 'Đóng' })[0]);

    await user.click(screen.getByRole('button', { name: `Ẩn đánh giá ${review.id}` }));
    const modDialog = await screen.findByRole('dialog');
    await user.type(within(modDialog).getByLabelText('Lý do xử lý'), 'Nội dung vi phạm quy định cộng đồng');
    await user.click(within(modDialog).getByRole('button', { name: 'Ẩn đánh giá' }));

    await waitFor(() => expect(modBodies).toHaveLength(1));
    expect(modBodies[0]).toEqual({ action: 'HIDE', reason: 'Nội dung vi phạm quy định cộng đồng' });
  });

  it('hides moderate buttons for REVIEWS:READ-only admin', async () => {
    const hiddenReview = makeReview({ status: 'HIDDEN' });
    const readOnly = makeAdmin({
      admin: { status: 'ACTIVE', permissions: [{ module: 'REVIEWS', actions: ['READ'] }] },
    });
    mockApi({
      ...signedIn(readOnly),
      'GET /admin/reviews': () => ok(page([hiddenReview])),
    });

    renderApp('/reviews');
    await screen.findByText('Lan Sinh Viên');
    expect(screen.queryByRole('button', { name: /Khôi phục đánh giá/i })).not.toBeInTheDocument();
  });

  it('restores HIDDEN reviews for moderators via A34', async () => {
    const hiddenReview = makeReview({ status: 'HIDDEN' });
    const modBodies: unknown[] = [];
    mockApi({
      ...signedIn(superAdmin()),
      'GET /admin/reviews': () => ok(page([hiddenReview])),
      [`PATCH /admin/reviews/${hiddenReview.id}/moderation`]: (_url, init) => {
        modBodies.push(body(init));
        return ok({ ...hiddenReview, status: 'PUBLISHED' });
      },
    });

    renderApp('/reviews');
    await screen.findByText('Lan Sinh Viên');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `Khôi phục đánh giá ${hiddenReview.id}` }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Lý do xử lý'), 'Đã xác minh đánh giá hợp lệ sau khiếu nại');
    await user.click(within(dialog).getByRole('button', { name: 'Khôi phục' }));

    await waitFor(() => expect(modBodies).toHaveLength(1));
    expect(modBodies[0]).toEqual({ action: 'RESTORE', reason: 'Đã xác minh đánh giá hợp lệ sau khiếu nại' });
  });
});
