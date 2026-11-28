import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Page } from '@contracts/api';
import type { PlaceCandidate, PlaceCategory } from '@contracts/places';
import { ForbiddenPage, PermissionGate } from '../../auth/guards';
import { formatDateTime } from '../../lib/format';
import { queryKeys, useApiQuery } from '../../lib/query';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  TextField,
} from '../../ui';
import { DuplicateCheckModal } from './components/DuplicateCheckModal';
import { MapPicker } from './components/MapPicker';
import { formatCoords, PLACE_CATEGORY_LABEL, PLACE_CATEGORY_OPTIONS, PLACE_ORIGIN_LABEL } from './placeLabels';

type ProviderCode = 'OSM' | 'WIKIDATA' | 'GOOGLE_PLACES';

type SearchParams = {
  q: string;
  category?: PlaceCategory;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  providers: string;
};

// ADM-08 - Tim & nhap dia diem tu nguon API ngoai (OSM / Wikidata / Google Places tuy chon)
// + A15 kiem tra trung + A17 xem truoc ban do ung vien
export function PlaceImportPage() {
  return (
    <PermissionGate access={{ module: 'PLACES', action: 'CREATE' }} fallback={<ForbiddenPage />}>
      <PlaceImportContent />
    </PermissionGate>
  );
}

function PlaceImportContent() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<PlaceCategory | ''>('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [radiusText, setRadiusText] = useState('5000');
  const [providers, setProviders] = useState<ProviderCode[]>(['OSM', 'WIKIDATA']);
  const [formError, setFormError] = useState<string>();
  const [submitted, setSubmitted] = useState<SearchParams>();
  const [previewCandidate, setPreviewCandidate] = useState<PlaceCandidate>();
  const [dupCandidate, setDupCandidate] = useState<PlaceCandidate>();

  const query = useApiQuery<Page<PlaceCandidate>>(
    queryKeys.places.candidates(submitted ?? {}),
    '/admin/place-candidates/search',
    {
      enabled: Boolean(submitted),
      query: submitted
        ? {
            q: submitted.q,
            category: submitted.category,
            lat: submitted.lat,
            lng: submitted.lng,
            radiusMeters: submitted.radiusMeters,
            providers: submitted.providers,
            limit: 20,
          }
        : undefined,
    },
  );

  const toggleProvider = (code: ProviderCode) => {
    setProviders(prev => (prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]));
  };

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setFormError('Vui lòng nhập từ khóa tìm kiếm tối thiểu 2 ký tự.');
      return;
    }
    if (providers.length === 0) {
      setFormError('Chọn ít nhất 1 nguồn dữ liệu (OSM, Wikidata hoặc Google Places).');
      return;
    }
    const lat = latText.trim() !== '' ? Number(latText) : undefined;
    const lng = lngText.trim() !== '' ? Number(lngText) : undefined;
    if ((lat !== undefined) !== (lng !== undefined)) {
      setFormError('Cần nhập đồng thời cả Vĩ độ (lat) và Kinh độ (lng), hoặc để trống cả hai.');
      return;
    }
    if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      setFormError('Vĩ độ (lat) phải nằm trong khoảng -90 đến 90.');
      return;
    }
    if (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      setFormError('Kinh độ (lng) phải nằm trong khoảng -180 đến 180.');
      return;
    }
    const radiusMeters = radiusText.trim() !== '' ? Number(radiusText) : undefined;
    setFormError(undefined);
    setSubmitted({
      q: trimmed,
      category: category || undefined,
      lat,
      lng,
      radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : undefined,
      providers: providers.join(','),
    });
  };

  return (
    <div className="page">
      <Link to="/places">← Danh sách địa điểm</Link>
      <PageHeader
        title="Nhập địa điểm từ nguồn ngoài"
        description="Tìm kiếm ứng viên từ OpenStreetMap, Wikidata (và Google Places nếu máy chủ có cấu hình khóa), kiểm tra trùng rồi chuyển sang biểu mẫu chuẩn hóa."
      />

      <Card>
        <form className="form" onSubmit={onSearch} noValidate>
          <div className="form-grid">
            <TextField
              label="Từ khóa tìm kiếm *"
              placeholder="vd: Thư viện Khoa học Tổng hợp, Highlands Coffee…"
              value={q}
              onChange={e => setQ(e.target.value)}
              maxLength={160}
            />
            <SelectField
              label="Gợi ý danh mục"
              placeholder="Không giới hạn"
              value={category}
              onChange={e => setCategory(e.target.value as PlaceCategory | '')}
              options={PLACE_CATEGORY_OPTIONS}
            />
            <TextField
              label="Vĩ độ tâm tìm kiếm (tùy chọn)"
              placeholder="vd: 10.7769"
              value={latText}
              onChange={e => setLatText(e.target.value)}
            />
            <TextField
              label="Kinh độ tâm tìm kiếm (tùy chọn)"
              placeholder="vd: 106.7009"
              value={lngText}
              onChange={e => setLngText(e.target.value)}
            />
            <TextField
              label="Bán kính (mét)"
              type="number"
              min={100}
              max={25000}
              value={radiusText}
              onChange={e => setRadiusText(e.target.value)}
            />
          </div>

          <div className="toolbar">
            <Checkbox label="OpenStreetMap (Nominatim)" checked={providers.includes('OSM')} onChange={() => toggleProvider('OSM')} />
            <Checkbox label="Wikidata" checked={providers.includes('WIKIDATA')} onChange={() => toggleProvider('WIKIDATA')} />
            <Checkbox label="Google Places (tùy chọn)" checked={providers.includes('GOOGLE_PLACES')} onChange={() => toggleProvider('GOOGLE_PLACES')} />
            <Button type="submit" loading={query.isFetching}>Tìm ứng viên</Button>
          </div>
          {formError && <div className="form-error" role="alert">{formError}</div>}
        </form>
      </Card>

      {!submitted && (
        <EmptyState
          title="Nhập từ khóa để tìm ứng viên địa điểm"
          description="Hệ thống truy vấn nguồn ngoài qua máy chủ backend, cấp token tạm có thời hạn và luôn gắn ghi chú bản quyền nguồn."
        />
      )}

      {submitted && query.isPending && <LoadingState label="Đang truy vấn nguồn ngoài…" />}
      {submitted && query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {submitted && !query.isPending && !query.error && query.data && (
        query.data.items.length === 0 ? (
          <EmptyState
            title="Không tìm thấy ứng viên nào"
            description="Thử từ khóa khác hoặc mở rộng danh sách nguồn dữ liệu."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Danh sách ứng viên từ nguồn ngoài</caption>
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Nguồn & Bản quyền</th>
                  <th>Danh mục gợi ý</th>
                  <th>Tọa độ</th>
                  <th>Hết hạn token</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.items.map(c => (
                  <tr key={c.candidateToken}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.addressText && <div className="muted">{c.addressText}</div>}
                    </td>
                    <td>
                      <Badge tone="info">{PLACE_ORIGIN_LABEL[c.provider]}</Badge>
                      {c.licenseNotice && <div className="muted" style={{ fontSize: 12 }}>{c.licenseNotice}</div>}
                    </td>
                    <td>{c.category ? PLACE_CATEGORY_LABEL[c.category] : '—'}</td>
                    <td>{formatCoords(c.location)}</td>
                    <td>{formatDateTime(c.expiresAt)}</td>
                    <td>
                      <div className="row-actions">
                        <Button variant="secondary" small onClick={() => setPreviewCandidate(c)}>
                          Bản đồ
                        </Button>
                        <Button variant="secondary" small onClick={() => setDupCandidate(c)}>
                          Kiểm tra trùng
                        </Button>
                        <Button
                          small
                          onClick={() => navigate('/places/new', { state: { candidate: c } })}
                        >
                          Dùng dữ liệu này
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* A17 - Xem truoc ban do ung vien */}
      {previewCandidate && (
        <Modal title={`Vị trí ứng viên: ${previewCandidate.name}`} size="L" onClose={() => setPreviewCandidate(undefined)}>
          <MapPicker lat={previewCandidate.location.lat} lng={previewCandidate.location.lng} height={320} />
          <dl className="facts">
            <dt>Nguồn</dt>
            <dd>{PLACE_ORIGIN_LABEL[previewCandidate.provider]} {previewCandidate.providerPlaceId ? `(${previewCandidate.providerPlaceId})` : ''}</dd>
            <dt>Địa chỉ gốc</dt>
            <dd>{previewCandidate.addressText ?? '—'}</dd>
            <dt>Bản quyền</dt>
            <dd>{previewCandidate.licenseNotice ?? '—'}</dd>
          </dl>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setPreviewCandidate(undefined)}>Đóng</Button>
            <Button onClick={() => navigate('/places/new', { state: { candidate: previewCandidate } })}>
              Dùng dữ liệu này
            </Button>
          </div>
        </Modal>
      )}

      {/* A15 - Kiem tra trung lap */}
      {dupCandidate && (
        <DuplicateCheckModal
          payload={{ name: dupCandidate.name, location: dupCandidate.location }}
          onClose={() => setDupCandidate(undefined)}
        />
      )}
    </div>
  );
}
