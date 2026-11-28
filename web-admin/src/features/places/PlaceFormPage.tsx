import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Page } from '@contracts/api';
import type {
  AttributeValue,
  OpeningDay,
  Place,
  PlaceCandidate,
  PlaceCategory,
  PlaceOrigin,
  PlacePatch,
  PlaceStatus,
  PlaceUpsert,
  QuietLevel,
  StudySuitability,
  TaxonomyItem,
} from '@contracts/places';
import { ForbiddenPage, PermissionGate } from '../../auth/guards';
import { api } from '../../lib/api';
import { queryKeys, useApiQuery } from '../../lib/query';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useConfirm,
  useSubmit,
  useToast,
} from '../../ui';
import { AttributeEditorModal } from './components/AttributeEditor';
import { DuplicateCheckModal } from './components/DuplicateCheckModal';
import { ImageManagerModal } from './components/ImageManagerModal';
import { MapPicker } from './components/MapPicker';
import { OpeningHoursModal } from './components/OpeningHoursEditor';
import {
  defaultOpeningHours,
  formatCoords,
  formatPriceRange,
  PLACE_CATEGORY_LABEL,
  PLACE_CATEGORY_OPTIONS,
  PLACE_ORIGIN_LABEL,
  PLACE_STATUS_LABEL,
  QUIET_LEVEL_LABEL,
  QUIET_LEVEL_OPTIONS,
  STUDY_SUITABILITY_LABEL,
  STUDY_SUITABILITY_OPTIONS,
  summarizeHours,
} from './placeLabels';

type FormState = {
  name: string;
  category: PlaceCategory;
  description: string;
  line1: string;
  provinceCode: string;
  wardCode: string;
  displayText: string;
  lat: string;
  lng: string;
  phone: string;
  website: string;
  minVnd: string;
  maxVnd: string;
  priceNote: string;
  amenities: string[];
  quietLevel: QuietLevel;
  studySuitability: StudySuitability;
  hours: OpeningDay[];
  attributes: AttributeValue[];
  imageFileIds: string[];
  coverFileId?: string;
  status: 'DRAFT' | 'PUBLISHED';
  origin: PlaceOrigin;
  importCandidateToken?: string;
  duplicateOverrideReason: string;
};

const DEFAULT_LAT = 10.7769;
const DEFAULT_LNG = 106.7009;

function initialForm(candidate?: PlaceCandidate): FormState {
  return {
    name: candidate?.name ?? '',
    category: candidate?.category ?? 'CAFE',
    description: '',
    line1: candidate?.addressText ?? '',
    provinceCode: '79',
    wardCode: '',
    displayText: candidate?.addressText ?? '',
    lat: String(candidate?.location.lat ?? DEFAULT_LAT),
    lng: String(candidate?.location.lng ?? DEFAULT_LNG),
    phone: '',
    website: '',
    minVnd: '',
    maxVnd: '',
    priceNote: '',
    amenities: [],
    quietLevel: 'UNKNOWN',
    studySuitability: 'UNKNOWN',
    hours: defaultOpeningHours(),
    attributes: [],
    imageFileIds: [],
    coverFileId: undefined,
    status: 'PUBLISHED',
    origin: candidate?.provider ?? 'MANUAL',
    importCandidateToken: candidate?.candidateToken,
    duplicateOverrideReason: '',
  };
}

function formFromPlace(p: Place): FormState {
  const cover = p.images.find(i => i.isCover)?.fileId ?? p.images[0]?.fileId;
  return {
    name: p.name,
    category: p.category,
    description: p.description ?? '',
    line1: p.address.line1,
    provinceCode: p.address.provinceCode,
    wardCode: p.address.wardCode ?? '',
    displayText: p.address.displayText ?? '',
    lat: String(p.location.lat),
    lng: String(p.location.lng),
    phone: p.phone ?? '',
    website: p.website ?? '',
    minVnd: p.price ? String(p.price.minVnd) : '',
    maxVnd: p.price ? String(p.price.maxVnd) : '',
    priceNote: p.price?.note ?? '',
    amenities: [...p.amenities],
    quietLevel: p.quietLevel,
    studySuitability: p.studySuitability,
    hours: p.hours.length > 0 ? p.hours : defaultOpeningHours(),
    attributes: p.attributes ? [...p.attributes] : [],
    imageFileIds: p.images.map(i => i.fileId),
    coverFileId: cover,
    status: p.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    origin: p.origin,
    importCandidateToken: undefined,
    duplicateOverrideReason: '',
  };
}

type SubModal = 'duplicate' | 'map' | 'hours' | 'attributes' | 'images' | 'preview';

// ADM-09 - Tao / Chinh sua dia diem (+ A15, A18, A19, A20, A21, A22, A23)
export function PlaceFormPage() {
  const { placeId } = useParams();
  const isEdit = Boolean(placeId);
  return (
    <PermissionGate
      access={{ module: 'PLACES', action: isEdit ? 'UPDATE' : 'CREATE' }}
      fallback={<ForbiddenPage />}
    >
      <PlaceFormInner placeId={placeId} />
    </PermissionGate>
  );
}

function PlaceFormInner({ placeId }: { placeId?: string }) {
  const isEdit = Boolean(placeId);
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmit();

  const candidate = (location.state as { candidate?: PlaceCandidate } | null)?.candidate;
  const existingQuery = useApiQuery<Place>(
    queryKeys.places.detail(placeId ?? ''),
    `/admin/places/${placeId ?? ''}`,
    { enabled: isEdit },
  );

  const [form, setForm] = useState<FormState>(() => initialForm(candidate));
  const [baseline, setBaseline] = useState<FormState>(() => initialForm(candidate));
  const [hydratedId, setHydratedId] = useState<string>();
  const [subModal, setSubModal] = useState<SubModal>();
  const [localError, setLocalError] = useState<string>();

  useEffect(() => {
    if (isEdit && existingQuery.data && hydratedId !== `${existingQuery.data.id}:${existingQuery.data.version}`) {
      const next = formFromPlace(existingQuery.data);
      setForm(next);
      setBaseline(next);
      setHydratedId(`${existingQuery.data.id}:${existingQuery.data.version}`);
    }
  }, [isEdit, existingQuery.data, hydratedId]);

  const provincesQuery = useApiQuery<Page<TaxonomyItem>>(
    queryKeys.taxonomies.provinces,
    '/locations/provinces',
    { query: { limit: 100 } },
  );
  const wardsQuery = useApiQuery<Page<TaxonomyItem>>(
    queryKeys.taxonomies.wards(form.provinceCode),
    '/locations/wards',
    { enabled: form.provinceCode !== '', query: { provinceCode: form.provinceCode, limit: 200 } },
  );
  const amenitiesQuery = useApiQuery<Page<TaxonomyItem>>(
    queryKeys.taxonomies.amenities,
    '/taxonomies/amenities',
    { query: { limit: 100 } },
  );

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  // A23 - Dirty guard on browser close/refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const lockedPaths = useMemo(
    () => new Set((existingQuery.data?.fieldStates ?? []).filter(fs => fs.locked).map(fs => fs.path)),
    [existingQuery.data],
  );

  if (isEdit && existingQuery.isPending) return <LoadingState />;
  if (isEdit && (existingQuery.error || !existingQuery.data)) {
    return (
      <div className="page">
        <Button variant="ghost" onClick={() => navigate('/places')}>← Danh sách địa điểm</Button>
        <ErrorState error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />
      </div>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const leave = async (to: string) => {
    if (
      !isDirty ||
      (await confirm({
        title: 'Rời khỏi form?',
        message: 'Thay đổi chưa lưu sẽ bị mất.',
        confirmLabel: 'Rời đi',
        destructive: true,
      }))
    ) {
      navigate(to);
    }
  };

  const parsedLat = Number(form.lat);
  const parsedLng = Number(form.lng);
  const coordsValid = Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 && Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180;

  const validateClient = (): string | undefined => {
    if (form.name.trim().length < 2) return 'Tên địa điểm cần tối thiểu 2 ký tự.';
    if (form.line1.trim().length < 3) return 'Địa chỉ chi tiết cần tối thiểu 3 ký tự.';
    if (!form.provinceCode) return 'Vui lòng chọn Tỉnh / Thành phố.';
    if (!coordsValid) return 'Tọa độ không hợp lệ (lat -90..90, lng -180..180).';
    if ((form.minVnd !== '' || form.maxVnd !== '') && (Number(form.minVnd || 0) > Number(form.maxVnd || 0))) {
      return 'Giá tối thiểu không được lớn hơn giá tối đa.';
    }
    return undefined;
  };

  const buildPrice = () => {
    if (form.minVnd === '' && form.maxVnd === '') return undefined;
    return {
      minVnd: Number(form.minVnd || 0),
      maxVnd: Number(form.maxVnd || form.minVnd || 0),
      ...(form.priceNote.trim() ? { note: form.priceNote.trim() } : {}),
      currency: 'VND' as const,
    };
  };

  const buildAddress = () => ({
    line1: form.line1.trim(),
    provinceCode: form.provinceCode,
    ...(form.wardCode ? { wardCode: form.wardCode } : {}),
    countryCode: 'VN' as const,
    ...(form.displayText.trim() ? { displayText: form.displayText.trim() } : {}),
  });

  const buildUpsert = (): PlaceUpsert => ({
    name: form.name.trim(),
    category: form.category,
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    address: buildAddress(),
    location: { lat: parsedLat, lng: parsedLng },
    ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    ...(form.website.trim() ? { website: form.website.trim() } : {}),
    ...(form.imageFileIds.length > 0 ? { imageFileIds: form.imageFileIds } : {}),
    ...(form.coverFileId ? { coverFileId: form.coverFileId } : {}),
    hours: form.hours,
    ...(buildPrice() ? { price: buildPrice() } : {}),
    amenities: form.amenities,
    quietLevel: form.quietLevel,
    studySuitability: form.studySuitability,
    ...(form.attributes.length > 0 ? { attributes: form.attributes } : {}),
    origin: form.origin,
    ...(form.importCandidateToken ? { importCandidateToken: form.importCandidateToken } : {}),
    status: form.status as PlaceStatus,
    ...(form.duplicateOverrideReason.trim().length >= 10
      ? { duplicateOverrideReason: form.duplicateOverrideReason.trim() }
      : {}),
  });

  const buildPatch = (existing: Place): PlacePatch => {
    const patch: PlacePatch = { version: existing.version };
    if (form.name.trim() !== baseline.name.trim()) patch.name = form.name.trim();
    if (form.category !== baseline.category) patch.category = form.category;
    if (form.description.trim() !== baseline.description.trim()) {
      patch.description = form.description.trim() || null;
    }
    if (
      form.line1 !== baseline.line1 ||
      form.provinceCode !== baseline.provinceCode ||
      form.wardCode !== baseline.wardCode ||
      form.displayText !== baseline.displayText
    ) {
      patch.address = buildAddress();
    }
    if (form.lat !== baseline.lat || form.lng !== baseline.lng) {
      patch.location = { lat: parsedLat, lng: parsedLng };
    }
    if (form.phone.trim() !== baseline.phone.trim()) patch.phone = form.phone.trim() || null;
    if (form.website.trim() !== baseline.website.trim()) patch.website = form.website.trim() || null;
    if (JSON.stringify(form.imageFileIds) !== JSON.stringify(baseline.imageFileIds)) {
      patch.imageFileIds = form.imageFileIds;
    }
    if (form.coverFileId !== baseline.coverFileId) {
      patch.coverFileId = form.coverFileId ?? null;
    }
    if (JSON.stringify(form.hours) !== JSON.stringify(baseline.hours)) patch.hours = form.hours;
    if (
      form.minVnd !== baseline.minVnd ||
      form.maxVnd !== baseline.maxVnd ||
      form.priceNote !== baseline.priceNote
    ) {
      patch.price = buildPrice() ?? null;
    }
    if (JSON.stringify(form.amenities) !== JSON.stringify(baseline.amenities)) patch.amenities = form.amenities;
    if (form.quietLevel !== baseline.quietLevel) patch.quietLevel = form.quietLevel;
    if (form.studySuitability !== baseline.studySuitability) patch.studySuitability = form.studySuitability;
    if (JSON.stringify(form.attributes) !== JSON.stringify(baseline.attributes)) patch.attributes = form.attributes;
    return patch;
  };

  const openPreview = (event: React.FormEvent) => {
    event.preventDefault();
    const err = validateClient();
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(undefined);
    setSubModal('preview');
  };

  const confirmSave = async () => {
    const err = validateClient();
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(undefined);
    const saved = await submit.run(() =>
      isEdit && existingQuery.data
        ? api.request<Place>(`/admin/places/${existingQuery.data.id}`, {
            method: 'PATCH',
            body: buildPatch(existingQuery.data),
          })
        : api.request<Place>('/admin/places', {
            method: 'POST',
            body: buildUpsert(),
          }),
    );
    if (saved) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }),
      ]);
      toast(isEdit ? 'Đã lưu cập nhật địa điểm.' : 'Đã tạo địa điểm mới.');
      setBaseline(form);
      setSubModal(undefined);
      navigate(`/places/${saved.id}`);
    }
  };

  const provinceOptions = (provincesQuery.data?.items ?? []).map(i => ({ value: i.code, label: i.name }));
  const wardOptions = (wardsQuery.data?.items ?? []).map(i => ({ value: i.code, label: i.name }));
  const amenityItems = amenitiesQuery.data?.items ?? [];

  const lockHint = (path: string) =>
    lockedPaths.has(path) ? 'Trường này đang bị khóa — mở khóa tại trang Chi tiết trước khi sửa.' : undefined;

  return (
    <div className="page">
      <div>
        <Button variant="ghost" small onClick={() => void leave(isEdit ? `/places/${placeId}` : '/places')}>
          ← {isEdit ? 'Quay lại chi tiết địa điểm' : 'Danh sách địa điểm'}
        </Button>
      </div>

      <PageHeader
        title={isEdit ? `Chỉnh sửa: ${existingQuery.data?.name ?? ''}` : 'Tạo địa điểm mới'}
        description={
          candidate
            ? `Đang điền sẵn từ nguồn ${PLACE_ORIGIN_LABEL[candidate.provider]}. Kiểm tra thông tin trước khi lưu.`
            : isEdit
              ? `Phiên bản hiện tại: v${existingQuery.data?.version ?? 1}.`
              : 'Nhập thông tin chi tiết cho địa điểm học tập.'
        }
        actions={
          <Button
            variant="secondary"
            disabled={!coordsValid || form.name.trim().length < 2}
            onClick={() => setSubModal('duplicate')}
          >
            Kiểm tra trùng
          </Button>
        }
      />

      {submit.error?.code === 'VERSION_CONFLICT' && (
        <div className="banner-danger" role="alert">
          Địa điểm đã được quản trị viên khác cập nhật trước đó.{' '}
          <Button
            variant="secondary"
            small
            onClick={() => {
              setHydratedId(undefined);
              void existingQuery.refetch();
              submit.reset();
            }}
          >
            Tải lại dữ liệu mới nhất
          </Button>
        </div>
      )}

      <form className="form" onSubmit={openPreview} noValidate>
        <Card className="form">
          <h2>Thông tin cơ bản</h2>
          <div className="form-grid">
            <TextField
              label="Tên địa điểm *"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              maxLength={160}
              disabled={lockedPaths.has('name')}
              hint={lockHint('name')}
              error={submit.fields.name}
            />
            <SelectField
              label="Danh mục *"
              value={form.category}
              onChange={e => update('category', e.target.value as PlaceCategory)}
              options={PLACE_CATEGORY_OPTIONS}
              disabled={lockedPaths.has('category')}
              hint={lockHint('category')}
              error={submit.fields.category}
            />
            <SelectField
              label="Độ yên tĩnh"
              value={form.quietLevel}
              onChange={e => update('quietLevel', e.target.value as QuietLevel)}
              options={QUIET_LEVEL_OPTIONS}
              disabled={lockedPaths.has('quietLevel')}
              hint={lockHint('quietLevel')}
            />
            <SelectField
              label="Phù hợp học tập"
              value={form.studySuitability}
              onChange={e => update('studySuitability', e.target.value as StudySuitability)}
              options={STUDY_SUITABILITY_OPTIONS}
              disabled={lockedPaths.has('studySuitability')}
              hint={lockHint('studySuitability')}
            />
            {!isEdit && (
              <SelectField
                label="Trạng thái khi tạo"
                value={form.status}
                onChange={e => update('status', e.target.value as 'DRAFT' | 'PUBLISHED')}
                options={[
                  { value: 'PUBLISHED', label: 'Xuất bản ngay' },
                  { value: 'DRAFT', label: 'Lưu bản nháp' },
                ]}
              />
            )}
          </div>
          <TextArea
            label="Mô tả"
            value={form.description}
            onChange={e => update('description', e.target.value)}
            maxLength={3000}
            disabled={lockedPaths.has('description')}
            hint={lockHint('description')}
            error={submit.fields.description}
          />
        </Card>

        <Card className="form">
          <div className="section-head">
            <h2>Địa chỉ & Vị trí trên bản đồ</h2>
            <Button variant="secondary" small onClick={() => setSubModal('map')}>
              Chọn vị trí & địa giới
            </Button>
          </div>
          <div className="form-grid">
            <TextField
              label="Số nhà, tên đường *"
              value={form.line1}
              onChange={e => update('line1', e.target.value)}
              maxLength={240}
              disabled={lockedPaths.has('address')}
              hint={lockHint('address')}
              error={submit.fields['address.line1']}
            />
            <SelectField
              label="Tỉnh / Thành phố *"
              value={form.provinceCode}
              onChange={e => {
                update('provinceCode', e.target.value);
                update('wardCode', '');
              }}
              placeholder="Chọn Tỉnh / Thành phố"
              options={
                provinceOptions.length > 0
                  ? provinceOptions
                  : [
                      { value: '79', label: 'TP. Hồ Chí Minh (79)' },
                      { value: '01', label: 'Hà Nội (01)' },
                      { value: '48', label: 'Đà Nẵng (48)' },
                    ]
              }
              disabled={lockedPaths.has('address')}
              error={submit.fields['address.provinceCode']}
            />
            <SelectField
              label="Phường / Xã"
              value={form.wardCode}
              onChange={e => update('wardCode', e.target.value)}
              placeholder={wardOptions.length > 0 ? 'Chọn Phường / Xã' : 'Không bắt buộc'}
              options={wardOptions}
              disabled={lockedPaths.has('address')}
            />
            <TextField
              label="Vĩ độ (lat) *"
              value={form.lat}
              onChange={e => update('lat', e.target.value)}
              disabled={lockedPaths.has('location')}
              hint={lockHint('location')}
              error={submit.fields['location.lat']}
            />
            <TextField
              label="Kinh độ (lng) *"
              value={form.lng}
              onChange={e => update('lng', e.target.value)}
              disabled={lockedPaths.has('location')}
              error={submit.fields['location.lng']}
            />
          </div>
        </Card>

        <Card className="form">
          <h2>Liên hệ, chi phí & tiện ích</h2>
          <div className="form-grid">
            <TextField
              label="Số điện thoại (E.164)"
              placeholder="+84901234567"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              disabled={lockedPaths.has('phone')}
              error={submit.fields.phone}
            />
            <TextField
              label="Website"
              placeholder="https://example.com"
              value={form.website}
              onChange={e => update('website', e.target.value)}
              disabled={lockedPaths.has('website')}
              error={submit.fields.website}
            />
            <TextField
              label="Giá tối thiểu (VND)"
              type="number"
              min={0}
              value={form.minVnd}
              onChange={e => update('minVnd', e.target.value)}
              disabled={lockedPaths.has('price')}
              error={submit.fields['price.minVnd']}
            />
            <TextField
              label="Giá tối đa (VND)"
              type="number"
              min={0}
              value={form.maxVnd}
              onChange={e => update('maxVnd', e.target.value)}
              disabled={lockedPaths.has('price')}
              error={submit.fields['price.maxVnd']}
            />
            <TextField
              label="Ghi chú giá"
              placeholder="vd: Miễn phí vào cửa, đồ uống từ 35k"
              value={form.priceNote}
              onChange={e => update('priceNote', e.target.value)}
              disabled={lockedPaths.has('price')}
            />
          </div>

          <div className="field">
            <span className="label">Tiện ích ({form.amenities.length})</span>
            <div className="chip-row">
              {amenityItems.map(am => {
                const selected = form.amenities.includes(am.code);
                return (
                  <button
                    key={am.code}
                    type="button"
                    className="chip-toggle"
                    aria-pressed={selected}
                    disabled={lockedPaths.has('amenities')}
                    onClick={() =>
                      update(
                        'amenities',
                        selected ? form.amenities.filter(c => c !== am.code) : [...form.amenities, am.code],
                      )
                    }
                  >
                    {am.name}
                  </button>
                );
              })}
              {amenityItems.length === 0 && <span className="muted">Chưa tải được danh sách tiện ích.</span>}
            </div>
          </div>
        </Card>

        <Card className="form">
          <h2>Giờ mở cửa, thuộc tính mở rộng & hình ảnh</h2>
          <div className="toolbar">
            <Button variant="secondary" disabled={lockedPaths.has('hours')} onClick={() => setSubModal('hours')}>
              Giờ mở cửa ({summarizeHours(form.hours)})
            </Button>
            <Button variant="secondary" disabled={lockedPaths.has('attributes')} onClick={() => setSubModal('attributes')}>
              Thuộc tính mở rộng ({form.attributes.length})
            </Button>
            <Button variant="secondary" disabled={lockedPaths.has('images')} onClick={() => setSubModal('images')}>
              Quản lý ảnh ({form.imageFileIds.length})
            </Button>
          </div>
          {!isEdit && form.duplicateOverrideReason && (
            <div className="banner">
              Đã ghi nhận lý do xác nhận không trùng: <strong>{form.duplicateOverrideReason}</strong>
            </div>
          )}
        </Card>

        {(localError || submit.message) && (
          <div className="form-error" role="alert">{localError ?? submit.message}</div>
        )}

        <div className="modal-actions">
          <Button variant="ghost" onClick={() => void leave(isEdit ? `/places/${placeId}` : '/places')}>
            Hủy
          </Button>
          <Button type="submit" loading={submit.pending}>
            Xem trước & lưu
          </Button>
        </div>
      </form>

      {/* A15 - Kiem tra trung */}
      {subModal === 'duplicate' && coordsValid && (
        <DuplicateCheckModal
          payload={{
            name: form.name.trim(),
            location: { lat: parsedLat, lng: parsedLng },
            address: form.line1.trim().length >= 3 && form.provinceCode ? buildAddress() : undefined,
            excludePlaceId: placeId,
          }}
          onOverride={!isEdit ? reason => update('duplicateOverrideReason', reason) : undefined}
          onClose={() => setSubModal(undefined)}
        />
      )}

      {/* A18 - Chon vi tri tren ban do & dia gioi */}
      {subModal === 'map' && (
        <Modal title="Chọn vị trí trên bản đồ (OSM)" size="L" onClose={() => setSubModal(undefined)}>
          <MapPicker
            lat={coordsValid ? parsedLat : DEFAULT_LAT}
            lng={coordsValid ? parsedLng : DEFAULT_LNG}
            interactive
            height={300}
            onChange={pt => {
              update('lat', String(pt.lat));
              update('lng', String(pt.lng));
            }}
          />
          <div className="form-grid">
            <TextField label="Vĩ độ (lat)" value={form.lat} onChange={e => update('lat', e.target.value)} />
            <TextField label="Kinh độ (lng)" value={form.lng} onChange={e => update('lng', e.target.value)} />
          </div>
          <div className="modal-actions">
            <Button onClick={() => setSubModal(undefined)}>Xong</Button>
          </div>
        </Modal>
      )}

      {/* A19 - Gio mo cua */}
      {subModal === 'hours' && (
        <OpeningHoursModal
          value={form.hours}
          onSave={next => update('hours', next)}
          onClose={() => setSubModal(undefined)}
        />
      )}

      {/* A20 - Thuoc tinh dong */}
      {subModal === 'attributes' && (
        <AttributeEditorModal
          category={form.category}
          values={form.attributes}
          onSaveValues={next => update('attributes', next)}
          onClose={() => setSubModal(undefined)}
        />
      )}

      {/* A21 - Quan ly anh */}
      {subModal === 'images' && (
        <ImageManagerModal
          images={existingQuery.data?.images ?? []}
          imageFileIds={form.imageFileIds}
          coverFileId={form.coverFileId}
          onSave={({ imageFileIds, coverFileId }) => {
            update('imageFileIds', imageFileIds);
            update('coverFileId', coverFileId);
          }}
          onClose={() => setSubModal(undefined)}
        />
      )}

      {/* A22 - Xem truoc & xac nhan luu */}
      {subModal === 'preview' && (
        <Modal title={isEdit ? 'Xem trước & lưu cập nhật' : 'Xem trước & tạo địa điểm'} size="L" onClose={() => setSubModal(undefined)}>
          <dl className="facts">
            <dt>Tên địa điểm</dt>
            <dd><strong>{form.name}</strong></dd>
            <dt>Danh mục</dt>
            <dd>{PLACE_CATEGORY_LABEL[form.category]}</dd>
            <dt>Nguồn</dt>
            <dd><Badge tone="neutral">{PLACE_ORIGIN_LABEL[form.origin]}</Badge></dd>
            {!isEdit && (
              <>
                <dt>Trạng thái</dt>
                <dd>{PLACE_STATUS_LABEL[form.status]}</dd>
              </>
            )}
            <dt>Địa chỉ</dt>
            <dd>{form.line1} (Mã tỉnh: {form.provinceCode}{form.wardCode ? `, Mã xã/phường: ${form.wardCode}` : ''})</dd>
            <dt>Tọa độ</dt>
            <dd>{formatCoords({ lat: parsedLat, lng: parsedLng })}</dd>
            <dt>Giờ mở cửa</dt>
            <dd>{summarizeHours(form.hours)}</dd>
            <dt>Khoảng giá</dt>
            <dd>{formatPriceRange(buildPrice())}</dd>
            <dt>Môi trường</dt>
            <dd>{QUIET_LEVEL_LABEL[form.quietLevel]} · {STUDY_SUITABILITY_LABEL[form.studySuitability]}</dd>
            <dt>Tiện ích</dt>
            <dd>{form.amenities.length > 0 ? form.amenities.join(', ') : '—'}</dd>
            <dt>Thuộc tính / Ảnh</dt>
            <dd>{form.attributes.length} thuộc tính · {form.imageFileIds.length} ảnh</dd>
          </dl>

          {!isEdit && submit.error?.code === 'DUPLICATE_PLACE_DETECTED' && (
            <div className="form">
              <div className="banner" role="alert">
                Máy chủ phát hiện địa điểm gần giống đã tồn tại. Nếu chắc chắn đây là cơ sở khác, nhập lý do bên dưới rồi lưu lại.
              </div>
              <TextArea
                label="Lý do xác nhận không trùng (tối thiểu 10 ký tự)"
                value={form.duplicateOverrideReason}
                onChange={e => update('duplicateOverrideReason', e.target.value)}
              />
            </div>
          )}

          {submit.message && <div className="form-error" role="alert">{submit.message}</div>}

          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setSubModal(undefined)}>Quay lại sửa</Button>
            <Button loading={submit.pending} onClick={() => void confirmSave()}>
              {isEdit ? 'Xác nhận lưu' : 'Xác nhận tạo địa điểm'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
