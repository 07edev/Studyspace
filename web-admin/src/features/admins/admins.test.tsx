import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { body, fail, mockApi, ok, page, renderApp, resetApi, signedIn, superAdmin } from '../../test/helpers';
import { samePermissions, togglePermission } from './PermissionMatrix';

beforeEach(resetApi);
afterEach(resetApi);

const USERS_READ = [{ module: 'USERS', actions: ['READ'] }];
const adminRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ad1',
  email: 'linh@example.test',
  displayName: 'Linh Tran',
  role: 'ADMIN',
  status: 'ACTIVE',
  permissions: USERS_READ,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});
const rootRow = adminRow({ id: 'root1', email: 'root@example.test', displayName: 'Root', role: 'SUPER_ADMIN', permissions: [] });
const me = superAdmin();

describe('PermissionMatrix helpers', () => {
  it('adds, removes and drops empty modules without touching the input', () => {
    const start = [{ module: 'USERS', actions: ['READ'] }];
    const added = togglePermission(start, 'USERS', 'UPDATE');
    expect(added).toEqual([{ module: 'USERS', actions: ['READ', 'UPDATE'] }]);
    expect(start).toEqual([{ module: 'USERS', actions: ['READ'] }]);
    expect(togglePermission(added, 'USERS', 'READ')).toEqual([{ module: 'USERS', actions: ['UPDATE'] }]);
    expect(togglePermission(start, 'USERS', 'READ')).toEqual([]);
    expect(togglePermission(start, 'PLACES', 'READ')).toEqual([...start, { module: 'PLACES', actions: ['READ'] }]);
  });

  it('compares lists by the access they grant, not by order', () => {
    expect(samePermissions([{ module: 'A', actions: ['X', 'Y'] }, { module: 'B', actions: ['Z'] }], [{ module: 'B', actions: ['Z'] }, { module: 'A', actions: ['Y', 'X'] }])).toBe(true);
    expect(samePermissions([{ module: 'A', actions: ['X'] }], [])).toBe(false);
  });
});

describe('ADM-05 admins list', () => {
  const routes = (extra: Record<string, () => Response> = {}) => ({
    ...signedIn(me),
    'GET /admin/admins': () => ok(page([rootRow, adminRow()])),
    ...extra,
  });

  it('lists admins and offers only the actions that make sense per row', async () => {
    mockApi(routes());
    renderApp('/admins');
    expect(await screen.findByText('Linh Tran')).toBeInTheDocument();
    expect(screen.getByText('(bạn)')).toBeInTheDocument();
    expect(screen.getByText('Toàn quyền')).toBeInTheDocument(); // Super Admin
    expect(within(screen.getByRole('table')).getByText('Người dùng')).toBeInTheDocument(); // permissions summary
    // Own row: no remove. Super Admin row: no permission editing (they have everything).
    expect(screen.queryByRole('button', { name: 'Gỡ quyền root@example.test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phân quyền root@example.test' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gỡ quyền linh@example.test' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phân quyền linh@example.test' })).toBeInTheDocument();
  });

  it('is not reachable for an admin who is not a Super Admin', async () => {
    mockApi({ ...signedIn(), 'GET /admin/admins': () => ok(page([])) });
    renderApp('/admins');
    expect(await screen.findByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();
  });
});

describe('A08 create', () => {
  it('validates, sends name/email/role/permissions, refreshes the list and confirms the invitation', async () => {
    let sent: unknown;
    let created = false;
    const api = mockApi({
      ...signedIn(me),
      'GET /admin/admins': () => ok(page(created ? [rootRow, adminRow()] : [rootRow])),
      'POST /admin/admins': (_u, init) => {
        sent = body(init);
        created = true;
        return ok({ ...adminRow(), invitationSent: true }, 201);
      },
    });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm quản trị viên' });

    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'L');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sai-email');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo và gửi lời mời' }));
    expect(within(dialog).getByText('Tên hiển thị cần từ 2 đến 100 ký tự.')).toBeInTheDocument();
    expect(within(dialog).getByText('Email không hợp lệ.')).toBeInTheDocument();
    expect(api.count('POST /admin/admins')).toBe(0);

    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'inh Tran');
    await userEvent.clear(within(dialog).getByLabelText('Email'));
    await userEvent.type(within(dialog).getByLabelText('Email'), ' Linh@Example.test ');
    await userEvent.click(within(dialog).getByLabelText('Người dùng: Xem'));
    await userEvent.click(within(dialog).getByLabelText('Người dùng: Sửa'));
    await userEvent.click(within(dialog).getByLabelText('Báo cáo: Phân công'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo và gửi lời mời' }));

    expect(await screen.findByText(/Đã tạo quản trị viên và gửi lời mời tới linh@example.test/)).toBeInTheDocument();
    expect(sent).toEqual({
      displayName: 'Linh Tran',
      email: 'linh@example.test',
      role: 'ADMIN',
      permissions: [{ module: 'USERS', actions: ['READ', 'UPDATE'] }, { module: 'REPORTS', actions: ['ASSIGN'] }],
    });
    expect(await screen.findByText('Linh Tran')).toBeInTheDocument(); // list refreshed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not offer the ADMINS module: only a Super Admin manages admins', async () => {
    mockApi({ ...signedIn(me), 'GET /admin/admins': () => ok(page([rootRow])) });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm quản trị viên' });
    expect(within(dialog).getAllByRole('checkbox').every(box => !/Quản lý Admin|ADMINS/.test(box.getAttribute('aria-label') ?? ''))).toBe(true);
  });

  it('puts a duplicate-email error under the email field and keeps what was typed', async () => {
    mockApi({
      ...signedIn(me),
      'GET /admin/admins': () => ok(page([rootRow])),
      'POST /admin/admins': () => fail(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng.', { details: [{ field: 'email', rule: 'unique', message: 'Email này đã được sử dụng.' }] }),
    });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm quản trị viên' });
    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'Linh Tran');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'taken@example.test');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo và gửi lời mời' }));
    expect(await within(dialog).findByText('Email này đã được sử dụng.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Email')).toHaveValue('taken@example.test');
  });

  it('warns clearly when the account was created but the email could not be sent', async () => {
    mockApi({
      ...signedIn(me),
      'GET /admin/admins': () => ok(page([rootRow])),
      'POST /admin/admins': () => ok({ ...adminRow(), invitationSent: false }, 201),
    });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm quản trị viên' });
    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'Linh Tran');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'linh@example.test');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo và gửi lời mời' }));
    expect(await screen.findByText(/chưa gửi được email/)).toBeInTheDocument();
  });

  it('asks before closing when something was typed', async () => {
    mockApi({ ...signedIn(me), 'GET /admin/admins': () => ok(page([rootRow])) });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm Admin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm quản trị viên' });
    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'Linh');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Rời khỏi form?')).toBeInTheDocument();
  });
});

describe('A09 edit', () => {
  const routes = (patch: (init: RequestInit) => Response) => ({
    ...signedIn(me),
    'GET /admin/admins': () => ok(page([rootRow, adminRow()])),
    'PATCH /admin/admins/ad1': (_u: URL, init: RequestInit) => patch(init),
  });

  it('sends only what changed', async () => {
    let sent: unknown;
    mockApi(routes(init => ((sent = body(init)), ok(adminRow({ displayName: 'Linh T.' })))));
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chỉnh sửa quản trị viên' });
    expect(within(dialog).getByLabelText('Email')).toBeDisabled(); // email cannot change
    await userEvent.clear(within(dialog).getByLabelText('Tên hiển thị'));
    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'Linh T.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Đã lưu thay đổi.')).toBeInTheDocument();
    expect(sent).toEqual({ displayName: 'Linh T.' });
  });

  it('closes without a request when nothing changed', async () => {
    const api = mockApi(routes(() => ok(adminRow())));
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chỉnh sửa quản trị viên' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.count('PATCH /admin/admins/ad1')).toBe(0);
  });

  it('asks to confirm before disabling, and does nothing when that is declined', async () => {
    let sent: unknown;
    const api = mockApi(routes(init => ((sent = body(init)), ok(adminRow({ status: 'DISABLED' })))));
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chỉnh sửa quản trị viên' });
    await userEvent.click(within(dialog).getByLabelText('Đang hoạt động'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    const ask = await screen.findByRole('alertdialog');
    await userEvent.click(within(ask).getByRole('button', { name: 'Hủy' }));
    expect(api.count('PATCH /admin/admins/ad1')).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Vô hiệu hóa' }));
    expect(await screen.findByText('Đã lưu thay đổi.')).toBeInTheDocument();
    expect(sent).toEqual({ status: 'DISABLED' });
  });

  it('does not let you disable yourself', async () => {
    mockApi({ ...signedIn(me), 'GET /admin/admins': () => ok(page([rootRow])) });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa root@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chỉnh sửa quản trị viên' });
    expect(within(dialog).getByLabelText('Đang hoạt động')).toBeDisabled();
  });

  it('shows the server message on a conflict and refreshes the list', async () => {
    const api = mockApi(routes(() => fail(409, 'INVALID_STATE_TRANSITION', 'Quản trị viên này đã bị vô hiệu hóa.')));
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chỉnh sửa quản trị viên' });
    await userEvent.clear(within(dialog).getByLabelText('Tên hiển thị'));
    await userEvent.type(within(dialog).getByLabelText('Tên hiển thị'), 'Tên khác');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await within(dialog).findByText('Quản trị viên này đã bị vô hiệu hóa.')).toBeInTheDocument();
    await waitFor(() => expect(api.count('GET /admin/admins')).toBeGreaterThanOrEqual(2));
  });
});

describe('A10 permissions', () => {
  const routes = (put: (init: RequestInit) => Response) => ({
    ...signedIn(me),
    'GET /admin/admins': () => ok(page([adminRow()])),
    'PUT /admin/admins/ad1/permissions': (_u: URL, init: RequestInit) => put(init),
  });

  it('starts from the current permissions, saves only after a change and replaces the whole list', async () => {
    let sent: unknown;
    mockApi(routes(init => ((sent = body(init)), ok(adminRow({ permissions: [{ module: 'PLACES', actions: ['READ'] }] })))));
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Phân quyền linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Phân quyền: Linh Tran' });
    expect(within(dialog).getByLabelText('Người dùng: Xem')).toBeChecked();
    expect(within(dialog).getByLabelText('Người dùng: Sửa')).not.toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Lưu quyền' })).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText('Người dùng: Xem')); // remove USERS
    await userEvent.click(within(dialog).getByLabelText('Địa điểm: Xem')); // add PLACES
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu quyền' }));
    expect(await screen.findByText(/Đã cập nhật quyền/)).toBeInTheDocument();
    expect(sent).toEqual({ permissions: [{ module: 'PLACES', actions: ['READ'] }] });
  });

  it('shows the server explanation for an invalid permission', async () => {
    mockApi(routes(() => fail(422, 'INVALID_PERMISSION', 'Danh sách quyền không hợp lệ.', { details: [{ field: 'permissions', rule: 'invalid', message: 'Module "X" không tồn tại.' }] })));
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Phân quyền linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Phân quyền: Linh Tran' });
    await userEvent.click(within(dialog).getByLabelText('Người dùng: Sửa'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu quyền' }));
    expect(await within(dialog).findByText('Module "X" không tồn tại.')).toBeInTheDocument();
  });
});

describe('A11 remove', () => {
  it('explains what happens, removes after confirmation and refreshes the list', async () => {
    let removed = false;
    const api = mockApi({
      ...signedIn(me),
      'GET /admin/admins': () => ok(page(removed ? [rootRow] : [rootRow, adminRow()])),
      'DELETE /admin/admins/ad1': () => ((removed = true), ok(undefined, 204)),
    });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Gỡ quyền linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gỡ quyền quản trị?' });
    expect(within(dialog).getByText(/Tài khoản vẫn tồn tại như một người dùng thông thường/)).toBeInTheDocument();
    expect(api.count('DELETE /admin/admins/ad1')).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Gỡ quyền' }));
    expect(await screen.findByText('Đã gỡ quyền quản trị.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Linh Tran')).not.toBeInTheDocument());
  });

  it('shows the reason when the server refuses', async () => {
    mockApi({
      ...signedIn(me),
      'GET /admin/admins': () => ok(page([rootRow, adminRow()])),
      'DELETE /admin/admins/ad1': () => fail(403, 'FORBIDDEN', 'Bạn không còn quyền Super Admin.'),
    });
    renderApp('/admins');
    await userEvent.click(await screen.findByRole('button', { name: 'Gỡ quyền linh@example.test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gỡ quyền quản trị?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Gỡ quyền' }));
    expect(await within(dialog).findByText('Bạn không còn quyền Super Admin.')).toBeInTheDocument();
  });
});
