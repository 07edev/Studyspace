import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { body, fail, makeAdmin, mockApi, ok, page, renderApp, resetApi, signedIn, superAdmin, userRow } from '../../test/helpers';

beforeEach(resetApi);
afterEach(resetApi);

const canUpdate = makeAdmin({ admin: { status: 'ACTIVE', permissions: [{ module: 'USERS', actions: ['READ', 'UPDATE'] }] } });

describe('ADM-03 users list', () => {
  it('loads the first page without sending empty filters and shows each user', async () => {
    let seen: URL | undefined;
    mockApi({
      ...signedIn(),
      'GET /admin/users': url => {
        seen = url;
        return ok(page([userRow(), userRow({ id: 'u2', email: 'bo@example.test', profile: { displayName: 'Bo' }, status: 'SUSPENDED' })]));
      },
    });
    renderApp('/users');
    expect(await screen.findByText('An Nguyen')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Bị khóa')).toBeInTheDocument();
    expect(seen!.search).toBe('?page=1&limit=20');
  });

  it('searches after typing stops and filters by status, then clears the filters', async () => {
    const urls: URL[] = [];
    mockApi({ ...signedIn(), 'GET /admin/users': url => (urls.push(url), ok(page([userRow()]))) });
    renderApp('/users');
    await screen.findByText('An Nguyen');
    await userEvent.type(screen.getByLabelText('Tìm kiếm'), 'an@');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('q')).toBe('an@'));
    expect(urls.filter(u => u.searchParams.get('q')).length).toBe(1); // one request, not one per key
    await userEvent.selectOptions(screen.getByLabelText('Trạng thái'), 'SUSPENDED');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('status')).toBe('SUSPENDED'));
    await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => expect(urls.at(-1)!.search).toBe('?page=1&limit=20'));
  });

  it('says so when a filter matches nobody, and when the request fails offers a retry', async () => {
    let fails = true;
    mockApi({
      ...signedIn(),
      'GET /admin/users': url =>
        url.searchParams.get('q') ? ok(page([])) : fails ? fail(500, 'INTERNAL', 'Máy chủ bận') : ok(page([userRow()])),
    });
    renderApp('/users');
    expect(await screen.findByText('Máy chủ bận', undefined, { timeout: 5000 })).toBeInTheDocument();
    fails = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('An Nguyen');
    await userEvent.type(screen.getByLabelText('Tìm kiếm'), 'zzz');
    expect(await screen.findByText('Không có người dùng phù hợp')).toBeInTheDocument();
  });

  it('goes to the next page', async () => {
    const pages: string[] = [];
    mockApi({
      ...signedIn(),
      'GET /admin/users': url => {
        pages.push(url.searchParams.get('page')!);
        return ok(page([userRow()], { hasNext: url.searchParams.get('page') === '1', totalPages: 2, total: 21 }));
      },
    });
    renderApp('/users');
    await screen.findByText('An Nguyen');
    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(pages).toContain('2'));
  });

  it('only offers lock buttons where the viewer may use them', async () => {
    mockApi({
      ...signedIn(canUpdate),
      'GET /admin/users': () =>
        ok(page([
          userRow({ id: 'a', email: 'normal@example.test' }),
          userRow({ id: canUpdate.id, email: 'me@example.test' }), // myself
          userRow({ id: 'r', email: 'root2@example.test', role: 'SUPER_ADMIN' }),
          userRow({ id: 'ad', email: 'other-admin@example.test', role: 'ADMIN' }), // admins: Super Admin only
          userRow({ id: 'd', email: 'gone@example.test', status: 'DELETED' }),
        ])),
    });
    renderApp('/users');
    await screen.findByText('normal@example.test');
    expect(screen.getByRole('button', { name: 'Khóa normal@example.test' })).toBeInTheDocument();
    for (const email of ['me@example.test', 'root2@example.test', 'other-admin@example.test', 'gone@example.test']) {
      expect(screen.queryByRole('button', { name: new RegExp(`(Khóa|Mở khóa) ${email}`) })).not.toBeInTheDocument();
    }
  });

  it('hides lock buttons from an admin without USERS.UPDATE', async () => {
    mockApi({ ...signedIn(), 'GET /admin/users': () => ok(page([userRow()])) });
    renderApp('/users');
    await screen.findByText('An Nguyen');
    expect(screen.queryByRole('button', { name: /Khóa/ })).not.toBeInTheDocument();
  });
});

describe('A06 quick view', () => {
  const detail = { user: userRow({ phone: '+84*****67' }), postCount: 3, moderationHistory: [] };

  it('loads the user only when opened and shows counts, using a dash where a count is not available', async () => {
    const api = mockApi({
      ...signedIn(),
      'GET /admin/users': () => ok(page([userRow()])),
      'GET /admin/users/user1': () => ok(detail),
    });
    renderApp('/users');
    await screen.findByText('An Nguyen');
    expect(api.count('GET /admin/users/user1')).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Xem nhanh an@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thông tin người dùng' });
    expect(await within(dialog).findByText('+84*****67')).toBeInTheDocument();
    const counts = within(within(dialog).getByLabelText('Nội dung của người dùng'));
    expect(counts.getByText('3')).toBeInTheDocument();
    expect(counts.getAllByText('—').length).toBe(3); // documents, reviews, suggestions
  });

  it('closes and tells the admin when the user no longer exists', async () => {
    mockApi({
      ...signedIn(),
      'GET /admin/users': () => ok(page([userRow()])),
      'GET /admin/users/user1': () => fail(404, 'NOT_FOUND', 'Không tìm thấy người dùng.'),
    });
    renderApp('/users');
    await screen.findByText('An Nguyen');
    await userEvent.click(screen.getByRole('button', { name: 'Xem nhanh an@example.test' }));
    expect(await screen.findByText('Người dùng này không còn tồn tại.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('A04 / A05 lock and unlock', () => {
  const setup = (patch: (init: RequestInit) => Response, row = userRow()) => {
    let current = row;
    return mockApi({
      ...signedIn(canUpdate),
      'GET /admin/users': () => ok(page([current])),
      'PATCH /admin/users/user1/status': (_u, init) => {
        const res = patch(init);
        if (res.ok) current = { ...current, status: body(init).action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE' };
        return res;
      },
    });
  };

  it('needs a reason of at least 10 characters before anything is sent', async () => {
    const api = setup(() => ok(userRow()));
    renderApp('/users');
    await userEvent.click(await screen.findByRole('button', { name: 'Khóa an@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Khóa tài khoản' });
    await userEvent.type(within(dialog).getByLabelText('Lý do'), 'quá ngắn');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Khóa tài khoản' }));
    expect(within(dialog).getByText('Lý do cần tối thiểu 10 ký tự.')).toBeInTheDocument();
    expect(api.count('PATCH /admin/users/user1/status')).toBe(0);
  });

  it('suspends with the reason, refreshes the list and confirms', async () => {
    let sent: unknown;
    setup(init => ((sent = body(init)), ok(userRow({ status: 'SUSPENDED' }))));
    renderApp('/users');
    await userEvent.click(await screen.findByRole('button', { name: 'Khóa an@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Khóa tài khoản' });
    await userEvent.type(within(dialog).getByLabelText('Lý do'), '  Spam liên tục nhiều lần  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Khóa tài khoản' }));
    expect(await screen.findByText('Đã khóa tài khoản.')).toBeInTheDocument();
    expect(sent).toEqual({ action: 'SUSPEND', reason: 'Spam liên tục nhiều lần' }); // trimmed
    expect(await screen.findByRole('button', { name: 'Mở khóa an@example.test' })).toBeInTheDocument(); // list refetched
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('unlocks a suspended account', async () => {
    let sent: unknown;
    setup(init => ((sent = body(init)), ok(userRow())), userRow({ status: 'SUSPENDED' }));
    renderApp('/users');
    await userEvent.click(await screen.findByRole('button', { name: 'Mở khóa an@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mở khóa tài khoản' });
    await userEvent.type(within(dialog).getByLabelText('Lý do'), 'Đã xác minh khiếu nại hợp lệ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mở khóa' }));
    expect(await screen.findByText('Đã mở khóa tài khoản.')).toBeInTheDocument();
    expect(sent).toEqual({ action: 'UNSUSPEND', reason: 'Đã xác minh khiếu nại hợp lệ' });
  });

  it('shows the server message on a conflict, keeps the dialog and reloads the list', async () => {
    const api = setup(() => fail(409, 'INVALID_STATE_TRANSITION', 'Chỉ có thể khóa tài khoản đang hoạt động hoặc đang chờ xác minh.'));
    renderApp('/users');
    await userEvent.click(await screen.findByRole('button', { name: 'Khóa an@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Khóa tài khoản' });
    await userEvent.type(within(dialog).getByLabelText('Lý do'), 'Spam liên tục nhiều lần');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Khóa tài khoản' }));
    expect(await within(dialog).findByText(/Chỉ có thể khóa/)).toBeInTheDocument();
    await waitFor(() => expect(api.count('GET /admin/users')).toBeGreaterThanOrEqual(2));
  });

  it('asks before throwing away a reason that was typed', async () => {
    setup(() => ok(userRow()));
    renderApp('/users');
    await userEvent.click(await screen.findByRole('button', { name: 'Khóa an@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Khóa tài khoản' });
    await userEvent.type(within(dialog).getByLabelText('Lý do'), 'Đang viết dở');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Rời khỏi form?')).toBeInTheDocument();
  });
});

describe('ADM-04 user detail', () => {
  const detail = { user: userRow(), postCount: 2, moderationHistory: [] };
  const routes = (extra: Record<string, () => Response> = {}) => ({
    ...signedIn(canUpdate),
    'GET /admin/users/user1': () => ok(detail),
    'GET /admin/users/user1/posts': () => ok(page([{ id: 'p1', title: 'Bài đầu tiên' }])),
    ...extra,
  });

  it('shows the summary and the first tab, and loads other tabs only when selected', async () => {
    const api = mockApi(routes({ 'GET /admin/users/user1/documents': () => fail(503, 'CONTENT_NOT_CONNECTED', 'chưa sẵn sàng') }));
    renderApp('/users/user1');
    expect(await screen.findByRole('heading', { name: 'An Nguyen' })).toBeInTheDocument();
    expect(await screen.findByText('Bài đầu tiên')).toBeInTheDocument();
    expect(api.count('GET /admin/users/user1/documents')).toBe(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Tài liệu' }));
    expect(await screen.findByText('Dữ liệu này chưa sẵn sàng')).toBeInTheDocument();
  });

  it('shows a not-found page for an unknown user', async () => {
    mockApi({ ...signedIn(canUpdate), 'GET /admin/users/zzz': () => fail(404, 'NOT_FOUND', 'Không tìm thấy người dùng.') });
    renderApp('/users/zzz');
    expect(await screen.findByText('Không tìm thấy người dùng', { selector: 'h2' })).toBeInTheDocument();
  });

  it('opens the moderation history (A07) with the reason and switches to activity', async () => {
    mockApi(routes({
      'GET /admin/users/user1/violations': () => ok(page([
        { id: 'e1', actorType: 'ADMIN', actorId: 'f'.repeat(24), action: 'USER_SUSPENDED', resourceType: 'user', after: { status: 'SUSPENDED', reason: 'Spam liên tục nhiều lần' }, requestId: 'req-77', createdAt: '2026-02-02T10:00:00.000Z' },
      ])),
      'GET /admin/users/user1/activity': () => ok(page([])),
    }));
    renderApp('/users/user1');
    await userEvent.click(await screen.findByRole('button', { name: 'Lịch sử xử lý' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lịch sử xử lý và hoạt động' });
    expect(await within(dialog).findByText('Khóa tài khoản')).toBeInTheDocument();
    expect(within(dialog).getByText('Lý do: Spam liên tục nhiều lần')).toBeInTheDocument();
    expect(within(dialog).getByText(/req-77/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Hoạt động' }));
    expect(await within(dialog).findByText('Chưa ghi nhận hoạt động nào.')).toBeInTheDocument();
  });

  it('lets a Super Admin lock an admin account from the detail page', async () => {
    mockApi({
      ...signedIn(superAdmin()),
      'GET /admin/users/ad1': () => ok({ user: userRow({ id: 'ad1', role: 'ADMIN', profile: { displayName: 'Admin Mot' } }), moderationHistory: [] }),
      'GET /admin/users/ad1/posts': () => fail(503, 'CONTENT_NOT_CONNECTED', 'x'),
    });
    renderApp('/users/ad1');
    await userEvent.click(await screen.findByRole('button', { name: 'Khóa tài khoản' }));
    expect(await screen.findByRole('dialog', { name: 'Khóa tài khoản' })).toBeInTheDocument();
  });
});
