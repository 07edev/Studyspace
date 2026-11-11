import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, makeAdmin, mockApi, ok, renderApp, resetApi, signedIn, superAdmin } from '../../test/helpers';

beforeEach(resetApi);
afterEach(() => {
  resetApi();
  vi.useRealTimers();
});

const statsAdmin = makeAdmin({ admin: { status: 'ACTIVE', permissions: [{ module: 'STATISTICS', actions: ['READ'] }] } });
const range = { from: '2026-03-08', to: '2026-03-14' };

describe('ADM-02 dashboard', () => {
  const dash = (extra: Record<string, unknown> = {}) => ({ totalUsers: 1200, newUsers: 35, range, ...extra });

  it('shows what is known and a dash with "Chưa kết nối" for numbers other teams have not provided', async () => {
    mockApi({ ...signedIn(statsAdmin), 'GET /admin/dashboard': () => ok(dash()) });
    renderApp('/dashboard');
    expect(await screen.findByText('1.200')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    const places = screen.getByText('Địa điểm').closest('.kpi') as HTMLElement;
    expect(within(places).getByText('—')).toBeInTheDocument();
    expect(within(places).getByText('Chưa kết nối')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument(); // never a made-up zero
  });

  it('shows connected numbers, links the pending queue only to pages the admin may open, and ranks categories', async () => {
    mockApi({
      ...signedIn(statsAdmin),
      'GET /admin/dashboard': () => ok(dash({ totalPlaces: 12, pendingSuggestions: 3, openReports: 0, placesByCategory: { cafe: 7, library: 5 } })),
    });
    renderApp('/dashboard');
    await screen.findByText('Đề xuất địa điểm chờ duyệt');
    const pending = screen.getByText('Đề xuất địa điểm chờ duyệt').closest('.kpi') as HTMLElement;
    expect(within(pending).getByText('3')).toBeInTheDocument();
    expect(within(pending).queryByRole('link')).not.toBeInTheDocument(); // no SUGGESTIONS.READ
    const reports = screen.getByText('Báo cáo đang mở').closest('.kpi') as HTMLElement;
    expect(within(reports).getByText('0')).toBeInTheDocument(); // a real zero, provided by the source
    const list = screen.getByRole('list', { name: 'Số địa điểm theo danh mục' });
    expect(within(list).getAllByRole('listitem').map(li => li.textContent)).toEqual(['cafe7', 'library5']);
  });

  it('links to the queue for an admin who may open it', async () => {
    mockApi({ ...signedIn(superAdmin()), 'GET /admin/dashboard': () => ok(dash({ pendingSuggestions: 3 })) });
    renderApp('/dashboard');
    await screen.findByText('Đề xuất địa điểm chờ duyệt');
    const pending = screen.getByText('Đề xuất địa điểm chờ duyệt').closest('.kpi') as HTMLElement;
    expect(within(pending).getByRole('link', { name: 'Xem danh sách' })).toHaveAttribute('href', '/place-suggestions');
  });

  it('names a source that could not answer', async () => {
    mockApi({ ...signedIn(statsAdmin), 'GET /admin/dashboard': () => ok(dash({ failedSources: ['places'] })) });
    renderApp('/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa lấy được số liệu từ: places');
  });

  it('asks again with the chosen number of days and can refresh', async () => {
    const urls: URL[] = [];
    mockApi({ ...signedIn(statsAdmin), 'GET /admin/dashboard': url => (urls.push(url), ok(dash({ newUsers: url.searchParams.get('days') === '30' ? 99 : 35 }))) });
    renderApp('/dashboard');
    await screen.findByText('35');
    await userEvent.click(screen.getByRole('button', { name: '30 ngày' }));
    expect(await screen.findByText('99')).toBeInTheDocument();
    expect(urls.at(-1)!.searchParams.get('days')).toBe('30');
    const before = urls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    await waitFor(() => expect(urls.length).toBeGreaterThan(before));
  });

  it('shows an error with retry when it cannot load', async () => {
    let failing = true;
    mockApi({ ...signedIn(statsAdmin), 'GET /admin/dashboard': () => (failing ? fail(500, 'X', 'Máy chủ bận') : ok(dash())) });
    renderApp('/dashboard');
    expect(await screen.findByText('Máy chủ bận', undefined, { timeout: 5000 })).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('1.200')).toBeInTheDocument();
  });
});

describe('ADM-24 activity statistics', () => {
  const activity = (over: Record<string, unknown> = {}) => ({
    items: [
      { date: '2026-03-12', users: 2, places: 1 },
      { date: '2026-03-13', users: 0, places: 4 },
      { date: '2026-03-14', users: 5, places: 0 },
    ],
    pagination: { page: 1, limit: 3, total: 3, totalPages: 1, hasNext: false },
    granularity: 'DAY', range, series: ['users', 'places'], ...over,
  });
  const setup = (handler: (url: URL) => Response = () => ok(activity())) => {
    // Pin today (Vietnam time) so the presets are predictable; only Date is faked, timers stay real.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-14T05:00:00Z') });
    const urls: URL[] = [];
    mockApi({ ...signedIn(statsAdmin), 'GET /admin/statistics/activity': url => (urls.push(url), handler(url)) });
    return urls;
  };

  it('starts with the last 30 days by day and draws one chart per measure', async () => {
    const urls = setup();
    renderApp('/statistics');
    expect(await screen.findByRole('group', { name: /Người dùng mới/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Địa điểm mới/ })).toBeInTheDocument();
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({ from: '2026-02-13', to: '2026-03-14', granularity: 'DAY' });
  });

  it('re-asks for a preset or a different grouping', async () => {
    const urls = setup();
    renderApp('/statistics');
    await screen.findByRole('group', { name: /Người dùng mới/ });
    await userEvent.click(screen.getByRole('button', { name: '7 ngày' }));
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('from')).toBe('2026-03-08'));
    await userEvent.selectOptions(screen.getByLabelText('Nhóm theo'), 'WEEK');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('granularity')).toBe('WEEK'));
  });

  it('checks a custom range before asking, and asks once it is valid', async () => {
    const urls = setup();
    renderApp('/statistics');
    await screen.findByRole('group', { name: /Người dùng mới/ });
    const asked = urls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Tùy chọn' }));
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-03-10');
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-03-01');
    expect(screen.getByText('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')).toBeInTheDocument();
    expect(urls.length).toBe(asked);
    await userEvent.clear(screen.getByLabelText('Từ ngày'));
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2024-01-01');
    await userEvent.clear(screen.getByLabelText('Đến ngày'));
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-03-14');
    expect(screen.getByText('Khoảng thời gian tối đa 366 ngày.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Từ ngày'));
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-03-01');
    await waitFor(() => expect(urls.at(-1)!.searchParams.get('from')).toBe('2026-03-01'));
  });

  it('can hide a measure, and the table shows exactly the same numbers', async () => {
    setup();
    renderApp('/statistics');
    await screen.findByRole('group', { name: /Địa điểm mới/ });
    await userEvent.click(screen.getByLabelText('Địa điểm mới'));
    expect(screen.queryByRole('group', { name: /Địa điểm mới/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Địa điểm mới'));
    await userEvent.click(screen.getByRole('button', { name: 'Bảng' }));
    const table = screen.getByRole('table', { name: 'Số mục mới theo thời gian' });
    const cells = within(table).getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell').map(c => c.textContent));
    expect(cells).toEqual([['2', '1'], ['0', '4'], ['5', '0']]);
    expect(within(table).getByRole('rowheader', { name: '14/03' })).toBeInTheDocument();
  });

  it('says which measures have no data yet instead of drawing empty charts', async () => {
    setup(() => ok(activity({ series: ['users'] })));
    renderApp('/statistics');
    await screen.findByRole('group', { name: /Người dùng mới/ });
    expect(screen.queryByRole('group', { name: /Địa điểm mới/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Chưa có số liệu: địa điểm, bài viết, tài liệu, báo cáo/)).toBeInTheDocument();
  });

  it('names a source that failed, and offers a retry when everything fails', async () => {
    let mode: 'partial' | 'down' = 'down';
    setup(() => (mode === 'down' ? fail(500, 'X', 'Máy chủ bận') : ok(activity({ failedSources: ['places'] }))));
    renderApp('/statistics');
    expect(await screen.findByText('Máy chủ bận', undefined, { timeout: 5000 })).toBeInTheDocument();
    mode = 'partial';
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/Chưa lấy được số liệu từ: places/)).toBeInTheDocument();
  });
});
