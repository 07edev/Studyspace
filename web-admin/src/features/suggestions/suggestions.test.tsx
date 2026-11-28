import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Suggestion } from '@contracts/places';
import { body, fail, makeAdmin, mockApi, ok, page, renderApp, resetApi, signedIn, superAdmin } from '../../test/helpers';

afterEach(resetApi);

const makeSuggestion = (overrides: Partial<Suggestion> = {}): Suggestion => ({
  id: '65f000000000000000000051',
  type: 'UPDATE',
  placeId: '65f000000000000000000011',
  placeName: 'The Study Hub Q1',
  changes: [
    {
      fieldPath: 'phone',
      oldValue: '+84901111111',
      newValue: '+84902222222',
      reason: 'Quán mới đổi số hotline trên fanpage.',
    },
  ],
  status: 'PENDING',
  submittedBy: { id: 'u9', displayName: 'Minh Sinh Viên' },
  createdAt: '2026-02-01T08:00:00.000Z',
  version: 1,
  ...overrides,
});

describe('Place Suggestions moderation (ADM-13, ADM-14)', () => {
  it('lists suggestions and opens A28 quick view', async () => {
    const item = makeSuggestion();
    mockApi({
      ...signedIn(superAdmin()),
      'GET /admin/place-suggestions': () => ok(page([item])),
      [`GET /admin/place-suggestions/${item.id}`]: () => ok(item),
    });

    renderApp('/place-suggestions');
    expect(await screen.findByText('The Study Hub Q1')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: `Xem nhanh đề xuất ${item.id}` }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Minh Sinh Viên')).toBeInTheDocument();
  });

  it('approves suggestion on ADM-14 with expectedVersion and Idempotency-Key', async () => {
    const item = makeSuggestion();
    const calls: { body: unknown; idem: string | null }[] = [];
    mockApi({
      ...signedIn(superAdmin()),
      [`GET /admin/place-suggestions/${item.id}`]: () => ok(item),
      [`POST /admin/place-suggestions/${item.id}/decision`]: (_url, init) => {
        const headers = new Headers(init.headers);
        calls.push({ body: body(init), idem: headers.get('Idempotency-Key') });
        return ok({ ...item, status: 'APPROVED', version: 2 });
      },
    });

    renderApp(`/place-suggestions/${item.id}`);
    expect(await screen.findByText('+84902222222')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Duyệt đề xuất' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận duyệt' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ action: 'APPROVE', expectedVersion: 1 });
    expect(calls[0].idem).toBe(`suggestion-approve-${item.id}-v1`);
  });

  it('requires >= 10 chars reason when rejecting (A30) and displays 409 conflict', async () => {
    const item = makeSuggestion();
    mockApi({
      ...signedIn(superAdmin()),
      [`GET /admin/place-suggestions/${item.id}`]: () => ok(item),
      [`POST /admin/place-suggestions/${item.id}/decision`]: () =>
        fail(409, 'VERSION_CONFLICT', 'Đề xuất đã được xử lý bởi quản trị viên khác.'),
    });

    renderApp(`/place-suggestions/${item.id}`);
    await screen.findByRole('heading', { name: 'The Study Hub Q1' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Từ chối' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Lý do từ chối/i), 'ngan');
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(within(dialog).getByText(/tối thiểu 10 ký tự/i)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/Lý do từ chối/i));
    await user.type(within(dialog).getByLabelText(/Lý do từ chối/i), 'Thông tin không khớp với nguồn xác thực');
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(await within(dialog).findByText(/xử lý bởi quản trị viên khác/i)).toBeInTheDocument();
  });

  it('hides moderation buttons for SUGGESTIONS:READ-only admin', async () => {
    const readOnly = makeAdmin({
      admin: { status: 'ACTIVE', permissions: [{ module: 'SUGGESTIONS', actions: ['READ'] }] },
    });
    const item = makeSuggestion();
    mockApi({
      ...signedIn(readOnly),
      [`GET /admin/place-suggestions/${item.id}`]: () => ok(item),
    });

    renderApp(`/place-suggestions/${item.id}`);
    await screen.findByRole('heading', { name: 'The Study Hub Q1' });
    expect(screen.queryByRole('button', { name: 'Duyệt đề xuất' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).not.toBeInTheDocument();
  });
});
