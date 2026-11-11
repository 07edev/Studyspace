import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fail, makeAdmin, mockApi, ok, page, renderApp, resetApi, signedIn } from '../../test/helpers';
import { actorName, diffRows, formatValue } from './audit';

beforeEach(resetApi);
afterEach(resetApi);

const reader = makeAdmin({ admin: { status: 'ACTIVE', permissions: [{ module: 'AUDIT', actions: ['READ'] }] } });
const ACTOR = 'a'.repeat(24);
const RESOURCE = 'b'.repeat(24);
const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'log1',
  actorId: ACTOR,
  actorType: 'ADMIN',
  actor: { displayName: 'Super Admin', email: 'root@example.test' },
  action: 'USER_SUSPENDED',
  resourceType: 'user',
  resourceId: RESOURCE,
  before: { status: 'ACTIVE' },
  after: { status: 'SUSPENDED', reason: 'Spam liên tục nhiều lần' },
  requestId: 'req-1',
  createdAt: '2026-03-01T10:00:00.000Z',
  ...overrides,
});

describe('audit helpers', () => {
  it('diffs top-level fields and marks the changed ones', () => {
    expect(diffRows({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual([
      { field: 'a', before: 1, after: undefined, changed: true },
      { field: 'b', before: 2, after: 3, changed: true },
      { field: 'c', before: undefined, after: 4, changed: true },
    ]);
    expect(diffRows({ x: { y: 1 } }, { x: { y: 1 } })[0].changed).toBe(false);
    expect(diffRows(undefined, undefined)).toEqual([]);
  });

  it('writes values readably: missing as a dash, secrets as hidden, objects as JSON', () => {
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue('[REDACTED]')).toBe('(đã ẩn)');
    expect(formatValue('abc')).toBe('abc');
    expect(formatValue(3)).toBe('3');
    expect(formatValue({ a: 1 })).toContain('"a": 1');
  });

  it('names the actor from the best information available', () => {
    expect(actorName(entry() as never)).toBe('Super Admin');
    expect(actorName(entry({ actor: { email: 'x@y.z' } }) as never)).toBe('x@y.z');
    expect(actorName(entry({ actor: undefined, actorType: 'SYSTEM', actorId: undefined }) as never)).toBe('Hệ thống');
    expect(actorName(entry({ actor: undefined }) as never)).toBe('Tài khoản …aaaaaa');
  });
});

describe('ADM-25 audit list', () => {
  const routes = (extra: Record<string, (url: URL) => Response> = {}) => ({
    ...signedIn(reader),
    'GET /admin/audit-logs': () => ok(page([entry(), entry({ id: 'log2', actorType: 'SYSTEM', actorId: undefined, actor: undefined, action: 'SOMETHING_ELSE', resourceType: 'outbox', resourceId: undefined })])),
    ...extra,
  });

  it('shows readable labels, the actor and the raw code, without sending empty filters', async () => {
    let seen: URL | undefined;
    mockApi(routes({ 'GET /admin/audit-logs': url => ((seen = url), ok(page([entry(), entry({ id: 'log2', actorType: 'SYSTEM', actorId: undefined, actor: undefined, action: 'SOMETHING_ELSE', resourceType: 'outbox', resourceId: undefined })]))) }));
    renderApp('/audit-logs');
    expect(await screen.findByText('Khóa tài khoản')).toBeInTheDocument();
    expect(screen.getByText('USER_SUSPENDED')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('SOMETHING_ELSE')).toBeInTheDocument(); // unknown action: shown as is
    expect(screen.getAllByText('Hệ thống').length).toBeGreaterThan(0);
    expect(seen!.search).toBe('?page=1&limit=20');
  });

  it('is not reachable without AUDIT.READ', async () => {
    mockApi({ ...signedIn(), 'GET /admin/audit-logs': () => ok(page([])) });
    renderApp('/audit-logs');
    expect(await screen.findByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();
  });

  it('filters by action (after typing stops), object type, actor type and Vietnam-time days', async () => {
    const urls: URL[] = [];
    mockApi(routes({ 'GET /admin/audit-logs': url => (urls.push(url), ok(page([entry()]))) }));
    renderApp('/audit-logs');
    await screen.findByText('Khóa tài khoản');
    await userEvent.type(screen.getByLabelText('Hành động'), 'susp');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('action')).toBe('susp'));
    expect(urls.filter(u => u.searchParams.get('action')).length).toBe(1);
    await userEvent.selectOptions(screen.getByLabelText('Đối tượng'), 'user');
    await userEvent.selectOptions(screen.getByLabelText('Người thực hiện'), 'ADMIN');
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-03-01');
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-03-02');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('to')).toBe('2026-03-02T23:59:59.999+07:00'));
    const last = urls.at(-1)!.searchParams;
    expect(Object.fromEntries(last)).toMatchObject({
      action: 'susp', resourceType: 'user', actorType: 'ADMIN', from: '2026-03-01T00:00:00+07:00', page: '1', limit: '20',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => expect(urls.at(-1)!.search).toBe('?page=1&limit=20'));
  });

  it('does not ask the server when the dates are the wrong way round', async () => {
    const urls: URL[] = [];
    mockApi(routes({ 'GET /admin/audit-logs': url => (urls.push(url), ok(page([entry()]))) }));
    renderApp('/audit-logs');
    await screen.findByText('Khóa tài khoản');
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-03-10');
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-03-01');
    expect(screen.getByText('Phải sau hoặc bằng ngày bắt đầu.')).toBeInTheDocument();
    expect(urls.some(u => u.searchParams.get('to'))).toBe(false);
  });

  it('says so when nothing matches and offers a retry when the request fails', async () => {
    let failing = true;
    mockApi(routes({ 'GET /admin/audit-logs': url => (url.searchParams.get('action') ? ok(page([])) : failing ? fail(500, 'X', 'Máy chủ bận') : ok(page([entry()]))) }));
    renderApp('/audit-logs');
    expect(await screen.findByText('Máy chủ bận', undefined, { timeout: 5000 })).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('Khóa tài khoản');
    await userEvent.type(screen.getByLabelText('Hành động'), 'zzz');
    expect(await screen.findByText('Không có bản ghi phù hợp')).toBeInTheDocument();
  });
});

describe('A50 / A51 detail and compare', () => {
  const routes = (detail: Record<string, unknown> = entry()) => ({
    ...signedIn(reader),
    'GET /admin/audit-logs': () => ok(page([entry()])),
    'GET /admin/audit-logs/log1': () => ok(detail),
  });
  const open = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /Xem chi tiết Khóa tài khoản/ }));
    return screen.findByRole('dialog', { name: 'Chi tiết nhật ký' });
  };

  it('loads the entry only when opened and shows metadata, actor and the result', async () => {
    const api = mockApi(routes());
    renderApp('/audit-logs');
    await screen.findByText('Khóa tài khoản');
    expect(api.count('GET /admin/audit-logs/log1')).toBe(0);
    const dialog = await open();
    expect(await within(dialog).findByText('req-1')).toBeInTheDocument();
    expect(within(dialog).getByText('root@example.test')).toBeInTheDocument();
    expect(within(dialog).getByText('Trạng thái ACTIVE → SUSPENDED. Lý do: Spam liên tục nhiều lần')).toBeInTheDocument();
  });

  it('compares before and after, marks changes and hides secrets', async () => {
    mockApi(routes(entry({ before: { password: '[REDACTED]', status: 'ACTIVE', same: 1 }, after: { password: '[REDACTED]', status: 'SUSPENDED', same: 1 } })));
    renderApp('/audit-logs');
    const dialog = await open();
    await userEvent.click(await within(dialog).findByRole('button', { name: 'So sánh trước/sau' }));
    const compare = await screen.findByRole('dialog', { name: 'So sánh trước/sau' });
    const rows = within(compare).getAllByRole('row').slice(1);
    const changed = rows.filter(r => r.className.includes('diff-changed')).map(r => within(r).getByRole('rowheader').textContent);
    expect(changed).toEqual(['status (đã thay đổi)']);
    expect(within(compare).getAllByText('(đã ẩn)').length).toBe(2);
    expect(within(compare).getByText(/được ẩn từ lúc ghi nhật ký/)).toBeInTheDocument();
    expect(within(compare).queryByText('hunter2')).not.toBeInTheDocument();
    await userEvent.click(within(compare).getAllByRole('button', { name: 'Đóng' }).at(-1)!); // the one at the bottom, not the corner X
    expect(await screen.findByRole('dialog', { name: 'Chi tiết nhật ký' })).toBeInTheDocument(); // back to the detail
  });

  it('offers no compare button when nothing was recorded before/after', async () => {
    mockApi(routes(entry({ before: undefined, after: undefined })));
    renderApp('/audit-logs');
    const dialog = await open();
    await within(dialog).findByText('req-1');
    expect(within(dialog).queryByRole('button', { name: 'So sánh trước/sau' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Đã ghi nhận.')).toBeInTheDocument();
  });

  it('turns "everything by this person" into a filter, shows it as a chip and lets it be removed', async () => {
    const urls: URL[] = [];
    mockApi({
      ...routes(),
      'GET /admin/audit-logs': url => (urls.push(url), ok(page([entry()]))),
    });
    renderApp('/audit-logs');
    const dialog = await open();
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Mọi việc của người này' }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('actorId')).toBe(ACTOR));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Người thực hiện' }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('actorId')).toBeNull());
  });

  it('shows an error with retry when the entry cannot be loaded', async () => {
    mockApi({ ...routes(), 'GET /admin/audit-logs/log1': () => fail(404, 'NOT_FOUND', 'Không tìm thấy bản ghi nhật ký.') });
    renderApp('/audit-logs');
    const dialog = await open();
    expect(await within(dialog).findByText('Không tìm thấy bản ghi nhật ký.')).toBeInTheDocument();
  });
});
