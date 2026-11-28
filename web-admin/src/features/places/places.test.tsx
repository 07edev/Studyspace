import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Place, PlaceCandidate } from '@contracts/places';
import { body, fail, makeAdmin, mockApi, ok, page, renderApp, resetApi } from '../../test/helpers';
import { signedIn, superAdmin } from '../../test/helpers';

afterEach(resetApi);

const makePlace = (overrides: Partial<Place> = {}): Place => ({
  id: '65f000000000000000000011',
  name: 'The Study Hub Q1',
  category: 'CAFE',
  description: 'Quán học bài yên tĩnh có ổ cắm.',
  address: { line1: '123 Lê Lợi', provinceCode: '79', wardCode: '26734', countryCode: 'VN', displayText: '123 Lê Lợi, Q1' },
  location: { lat: 10.7769, lng: 106.7009 },
  images: [],
  hours: [{ day: 'MON', closed: false, intervals: [{ open: '08:00', close: '22:00' }] }],
  amenities: ['WIFI', 'POWER_OUTLET'],
  quietLevel: 'QUIET',
  studySuitability: 'BOTH',
  origin: 'MANUAL',
  status: 'PUBLISHED',
  ratingAverage: 4.5,
  ratingCount: 12,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 2,
  fieldStates: [
    { path: 'name', verified: 'VERIFIED', locked: false, note: 'Đã gọi xác nhận' },
  ],
  sources: [
    { provider: 'OSM', providerPlaceId: 'node/123', licenseNote: '© OpenStreetMap contributors' },
  ],
  ...overrides,
});

const baseTaxonomyMocks = () => ({
  'GET /locations/provinces': () => ok(page([{ id: 'p1', code: '79', name: 'TP. Hồ Chí Minh', active: true }])),
  'GET /locations/wards': () => ok(page([{ id: 'w1', code: '26734', name: 'Phường Bến Nghé', parentId: 'p1', active: true }])),
  'GET /taxonomies/amenities': () => ok(page([{ id: 'a1', code: 'WIFI', name: 'Wi-Fi mạnh', active: true }])),
});

describe('Places management (ADM-06, ADM-08, ADM-09, ADM-10)', () => {
  it('lists places, hides create/update controls for read-only admin, and opens A16 quick view', async () => {
    const readOnlyAdmin = makeAdmin({
      admin: { status: 'ACTIVE', permissions: [{ module: 'PLACES', actions: ['READ'] }] },
    });
    const place = makePlace();
    mockApi({
      ...signedIn(readOnlyAdmin),
      'GET /admin/places': () => ok(page([place])),
      [`GET /admin/places/${place.id}`]: () => ok(place),
    });

    renderApp('/places');
    expect(await screen.findByText('The Study Hub Q1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Thêm địa điểm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ẩn The Study Hub Q1/i })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Xem nhanh The Study Hub Q1' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/4\.5 ★/)).toBeInTheDocument();
  });

  it('changes place status via A13 modal and invalidates stats', async () => {
    const place = makePlace({ status: 'PUBLISHED' });
    const patchedBodies: unknown[] = [];
    mockApi({
      ...signedIn(superAdmin()),
      'GET /admin/places': () => ok(page([place])),
      [`PATCH /admin/places/${place.id}/status`]: (_url, init) => {
        patchedBodies.push(body(init));
        return ok({ ...place, status: 'HIDDEN', version: 3 });
      },
    });

    renderApp('/places');
    await screen.findByText('The Study Hub Q1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ẩn The Study Hub Q1' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Lý do thực hiện'), 'Quán tạm đóng cửa bảo trì');
    await user.click(within(dialog).getByRole('button', { name: 'Ẩn địa điểm' }));

    await waitFor(() => expect(patchedBodies).toHaveLength(1));
    expect(patchedBodies[0]).toEqual({ status: 'HIDDEN', reason: 'Quán tạm đóng cửa bảo trì' });
  });

  it('imports an external candidate (ADM-08) into ADM-09 create form and submits PlaceUpsert', async () => {
    const candidate: PlaceCandidate = {
      candidateToken: 'tok-abc-123',
      provider: 'OSM',
      providerPlaceId: 'node/999',
      name: 'Thư viện Trung Tâm',
      addressText: '69 Lý Tự Trọng',
      location: { lat: 10.775, lng: 106.699 },
      category: 'LIBRARY',
      expiresAt: '2026-12-01T00:00:00.000Z',
      licenseNotice: '© OpenStreetMap contributors',
    };
    const createdPlace = makePlace({ id: '65f000000000000000000099', name: 'Thư viện Trung Tâm', origin: 'OSM' });
    const postPayloads: unknown[] = [];
    mockApi({
      ...signedIn(superAdmin()),
      ...baseTaxonomyMocks(),
      'GET /admin/place-candidates/search': () => ok(page([candidate])),
      'POST /admin/places': (_url, init) => {
        postPayloads.push(body(init));
        return ok(createdPlace, 201);
      },
      [`GET /admin/places/${createdPlace.id}`]: () => ok(createdPlace),
      'GET /admin/reviews': () => ok(page([])),
    });

    renderApp('/places/import');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Từ khóa tìm kiếm/i), 'Thư viện');
    await user.click(screen.getByRole('button', { name: 'Tìm ứng viên' }));

    expect(await screen.findByText('Thư viện Trung Tâm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dùng dữ liệu này' }));

    // Now on ADM-09 prefilled with candidate data
    expect(await screen.findByDisplayValue('Thư viện Trung Tâm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem trước & lưu' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận tạo địa điểm' }));

    await waitFor(() => expect(postPayloads).toHaveLength(1));
    expect(postPayloads[0]).toMatchObject({
      name: 'Thư viện Trung Tâm',
      origin: 'OSM',
      importCandidateToken: 'tok-abc-123',
      category: 'LIBRARY',
    });
  });

  it('supports ADM-10 field lock (A25) and history diff modal (A26)', async () => {
    const place = makePlace();
    const fieldDecisions: unknown[] = [];
    mockApi({
      ...signedIn(superAdmin()),
      [`GET /admin/places/${place.id}`]: () => ok(place),
      'GET /admin/reviews': () => ok(page([])),
      [`PATCH /admin/places/${place.id}/fields/state`]: (_url, init) => {
        fieldDecisions.push(body(init));
        return ok({
          ...place,
          fieldStates: [{ path: 'name', verified: 'VERIFIED', locked: true, note: 'Chốt tên chính thức' }],
        });
      },
      [`GET /admin/places/${place.id}/history`]: () =>
        ok(
          page([
            {
              id: 'h1',
              placeId: place.id,
              actorId: 'root1',
              changedAt: '2026-01-02T10:00:00.000Z',
              diff: [{ field: 'name', before: 'Old Name', after: 'The Study Hub Q1' }],
            },
          ]),
        ),
    });

    renderApp(`/places/${place.id}`);
    expect(await screen.findByRole('heading', { name: 'The Study Hub Q1' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Khóa name' }));
    const lockDialog = await screen.findByRole('dialog');
    await user.type(within(lockDialog).getByLabelText('Lý do'), 'Chốt tên chính thức');
    await user.click(within(lockDialog).getByRole('button', { name: 'Khóa trường' }));

    await waitFor(() => expect(fieldDecisions).toHaveLength(1));
    expect(fieldDecisions[0]).toEqual({ path: 'name', action: 'LOCK', reason: 'Chốt tên chính thức' });

    await user.click(screen.getByRole('button', { name: 'Lịch sử thay đổi' }));
    const histDialog = await screen.findByRole('dialog');
    expect(await within(histDialog).findByText('Old Name')).toBeInTheDocument();
  });

  it('blocks /places/new when admin lacks PLACES:CREATE and maps 422 errors on submit', async () => {
    const readOnlyAdmin = makeAdmin({
      admin: { status: 'ACTIVE', permissions: [{ module: 'PLACES', actions: ['READ'] }] },
    });
    mockApi({ ...signedIn(readOnlyAdmin) });

    renderApp('/places/new');
    expect(await screen.findByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();

    resetApi();
    mockApi({
      ...signedIn(superAdmin()),
      ...baseTaxonomyMocks(),
      'POST /admin/places': () =>
        fail(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', {
          details: [{ field: 'name', rule: 'minLength', message: 'Tên địa điểm không hợp lệ từ server.' }],
        }),
    });

    renderApp('/places/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Tên địa điểm/i), 'Quán A');
    await user.type(screen.getByLabelText(/Số nhà, tên đường/i), '12 Nguyễn Huệ');
    await user.click(screen.getByRole('button', { name: 'Xem trước & lưu' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận tạo địa điểm' }));

    // Close preview or read field error mapped onto form
    await user.click(within(dialog).getByRole('button', { name: 'Quay lại sửa' }));
    expect(await screen.findByText('Tên địa điểm không hợp lệ từ server.')).toBeInTheDocument();
  });
});
