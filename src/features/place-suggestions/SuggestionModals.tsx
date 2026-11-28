import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSessionManager } from '../../shared/auth/AuthProvider';
import type { Page } from '../../shared/contracts/api';
import type {
  DuplicateResult,
  Place,
  PlaceCategory,
  QuietLevel,
  StudySuitability,
  Suggestion,
  SuggestionChange,
  SuggestionCreate,
  TaxonomyItem,
} from '../../shared/contracts/places';
import { queryKeys, useApiQuery, usePagedQuery, useQueryClient, withQuery } from '../../shared/query';
import { colors, radii } from '../../shared/theme/tokens';
import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  PagedList,
  SelectField,
  TextField,
  useToast,
} from '../../shared/ui';
import { useDirtyGuard, useSubmit } from '../auth/formHooks';
import { MapCanvas } from '../places/components/MapCanvas';
import {
  formatAddress,
  PLACE_CATEGORY_LABEL,
  QUIET_LEVEL_LABEL,
  STUDY_SUITABILITY_LABEL,
  SUGGESTABLE_FIELDS,
  SUGGESTION_STATUS_LABEL,
  SUGGESTION_TYPE_LABEL,
} from '../places/placeLabels';
import { placesApi } from '../places/placesApi';

const CATEGORY_OPTIONS: { value: PlaceCategory; label: string }[] = [
  { value: 'CAFE', label: PLACE_CATEGORY_LABEL.CAFE },
  { value: 'LIBRARY', label: PLACE_CATEGORY_LABEL.LIBRARY },
  { value: 'COWORKING', label: PLACE_CATEGORY_LABEL.COWORKING },
  { value: 'STUDY_ROOM', label: PLACE_CATEGORY_LABEL.STUDY_ROOM },
  { value: 'OTHER', label: PLACE_CATEGORY_LABEL.OTHER },
];

const QUIET_OPTIONS: { value: QuietLevel; label: string }[] = [
  { value: 'VERY_QUIET', label: QUIET_LEVEL_LABEL.VERY_QUIET },
  { value: 'QUIET', label: QUIET_LEVEL_LABEL.QUIET },
  { value: 'MODERATE', label: QUIET_LEVEL_LABEL.MODERATE },
  { value: 'NOISY', label: QUIET_LEVEL_LABEL.NOISY },
  { value: 'UNKNOWN', label: QUIET_LEVEL_LABEL.UNKNOWN },
];

const SUITABILITY_OPTIONS: { value: StudySuitability; label: string }[] = [
  { value: 'SOLO', label: STUDY_SUITABILITY_LABEL.SOLO },
  { value: 'GROUP', label: STUDY_SUITABILITY_LABEL.GROUP },
  { value: 'BOTH', label: STUDY_SUITABILITY_LABEL.BOTH },
  { value: 'UNKNOWN', label: STUDY_SUITABILITY_LABEL.UNKNOWN },
];

const DEFAULT_LAT = 10.7769;
const DEFAULT_LNG = 106.7009;

// U20 (De xuat dia diem moi) + U21 (Chon toa do MapCanvas) + U22 (Canh bao trung lap) + U25 (Xac nhan gui)
export function CreateSuggestionModal() {
  const manager = useSessionManager();
  const queryClient = useQueryClient();
  const { open, setDirty } = useModal();
  const toast = useToast();
  const submit = useSubmit();
  const dupSubmit = useSubmit();
  const api = useMemo(() => placesApi(manager), [manager]);
  const idemKeyRef = useRef(`suggest-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const [step, setStep] = useState<'form' | 'map' | 'duplicates' | 'confirm'>('form');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('CAFE');
  const [line1, setLine1] = useState('');
  const [provinceCode, setProvinceCode] = useState('79');
  const [wardCode, setWardCode] = useState('');
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [quietLevel, setQuietLevel] = useState<QuietLevel>('QUIET');
  const [studySuitability, setStudySuitability] = useState<StudySuitability>('BOTH');
  const [dupResult, setDupResult] = useState<DuplicateResult>();
  const [localError, setLocalError] = useState<string>();

  const provincesQuery = useApiQuery<Page<TaxonomyItem>>(
    queryKeys.taxonomy.provinces(),
    '/locations/provinces',
    { authenticated: false },
  );
  const wardsQuery = useApiQuery<Page<TaxonomyItem>>(
    queryKeys.taxonomy.wards(provinceCode),
    withQuery('/locations/wards', { provinceCode }),
    { authenticated: false, enabled: provinceCode !== '' },
  );

  const isDirty = name.trim() !== '' || line1.trim() !== '' || description.trim() !== '';
  useDirtyGuard(isDirty);

  const provinceOptions = (provincesQuery.data?.items ?? []).length > 0
    ? provincesQuery.data!.items.map(i => ({ value: i.code, label: i.name }))
    : [
        { value: '79', label: 'TP. Hồ Chí Minh' },
        { value: '01', label: 'Hà Nội' },
        { value: '48', label: 'Đà Nẵng' },
      ];
  const wardOptions = (wardsQuery.data?.items ?? []).map(i => ({ value: i.code, label: i.name }));

  const validateAndCheckDuplicates = async () => {
    if (name.trim().length < 2) {
      setLocalError('Tên địa điểm cần tối thiểu 2 ký tự.');
      return;
    }
    if (line1.trim().length < 3) {
      setLocalError('Địa chỉ chi tiết cần tối thiểu 3 ký tự.');
      return;
    }
    setLocalError(undefined);
    const result = await dupSubmit.run(() =>
      api.checkSuggestionDuplicate({
        name: name.trim(),
        location: { lat, lng },
        address: {
          line1: line1.trim(),
          provinceCode,
          ...(wardCode ? { wardCode } : {}),
          countryCode: 'VN',
        },
      }),
    );
    if (result) {
      setDupResult(result);
      if (result.possibleDuplicates.length > 0) {
        setStep('duplicates');
      } else {
        setStep('confirm');
      }
    }
  };

  const confirmSubmit = async () => {
    const payload: SuggestionCreate = {
      type: 'CREATE',
      proposedPlace: {
        name: name.trim(),
        category,
        address: {
          line1: line1.trim(),
          provinceCode,
          ...(wardCode ? { wardCode } : {}),
          countryCode: 'VN',
        },
        location: { lat, lng },
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        quietLevel,
        studySuitability,
        origin: 'USER_SUGGESTION',
      },
    };
    const created = await submit.run(() => api.createSuggestion(payload, idemKeyRef.current));
    if (created) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.suggestions.all });
      setDirty(false);
      toast('Đã gửi đề xuất địa điểm mới. Cảm ơn đóng góp của bạn!');
      open({ name: 'feature', feature: 'suggestions' });
    }
  };

  // U21 - Chon toa do tren ban do OSM
  if (step === 'map') {
    return (
      <View style={styles.section}>
        <AppText variant="heading">Chọn vị trí trên bản đồ (OSM)</AppText>
        <AppText variant="caption" muted>
          Chạm lên bản đồ để ghim tọa độ chính xác cho địa điểm.
        </AppText>
        <MapCanvas
          center={{ lat, lng }}
          selectable
          selectedPoint={{ lat, lng }}
          height={320}
          onSelectPoint={pt => {
            setLat(pt.lat);
            setLng(pt.lng);
          }}
        />
        <AppText variant="caption">
          Tọa độ đã chọn: {lat.toFixed(5)}, {lng.toFixed(5)}
        </AppText>
        <Button title="Xác nhận vị trí" onPress={() => setStep('form')} />
      </View>
    );
  }

  // U22 - Canh bao dia diem co the trung lap
  if (step === 'duplicates' && dupResult) {
    return (
      <View style={styles.section}>
        <AppText variant="heading">Phát hiện địa điểm gần giống</AppText>
        <AppText muted>
          Kiểm tra xem địa điểm bạn muốn thêm đã có sẵn trên StudySpace chưa trước khi gửi đề xuất mới.
        </AppText>
        {dupResult.possibleDuplicates.map(item => (
          <Card key={item.placeId} style={styles.dupCard}>
            <AppText variant="label">{item.name}</AppText>
            {item.addressText ? <AppText variant="caption" muted>{item.addressText}</AppText> : null}
            <AppText variant="caption" muted>
              Cách {Math.round(item.distanceMeters)} m · Tương đồng {Math.round(item.similarityScore * 100)}%
            </AppText>
            <Button
              variant="secondary"
              title="Mở địa điểm này"
              onPress={() => {
                setDirty(false);
                open({ name: 'place-detail', placeId: item.placeId });
              }}
            />
          </Card>
        ))}
        <Button title="Không trùng, tiếp tục xác nhận" onPress={() => setStep('confirm')} />
        <Button variant="ghost" title="Quay lại chỉnh sửa" onPress={() => setStep('form')} />
      </View>
    );
  }

  // U25 - Xac nhan gui de xuat
  if (step === 'confirm') {
    return (
      <View style={styles.section}>
        <AppText variant="heading">Xác nhận gửi đề xuất mới</AppText>
        <Card style={styles.infoCard}>
          <AppText variant="label">{name.trim()}</AppText>
          <AppText variant="caption" muted>{PLACE_CATEGORY_LABEL[category]}</AppText>
          <AppText>{line1.trim()} (Mã tỉnh: {provinceCode}{wardCode ? `, ${wardCode}` : ''})</AppText>
          <AppText variant="caption" muted>Tọa độ: {lat.toFixed(5)}, {lng.toFixed(5)}</AppText>
          <AppText variant="caption" muted>
            {QUIET_LEVEL_LABEL[quietLevel]} · {STUDY_SUITABILITY_LABEL[studySuitability]}
          </AppText>
          {description.trim() ? <AppText muted>{description.trim()}</AppText> : null}
        </Card>
        {submit.message ? (
          <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
            {submit.message}
          </AppText>
        ) : null}
        <Button title="Xác nhận gửi đề xuất" loading={submit.pending} onPress={confirmSubmit} />
        <Button variant="ghost" title="Quay lại chỉnh sửa" onPress={() => setStep('form')} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <TextField
        label="Tên địa điểm *"
        value={name}
        onChangeText={setName}
        placeholder="vd: The Study Corner Q3"
        error={localError && name.trim().length < 2 ? localError : submit.fields['proposedPlace.name']}
      />
      <SelectField
        label="Danh mục *"
        value={category}
        options={CATEGORY_OPTIONS}
        onChange={setCategory}
      />
      <TextField
        label="Địa chỉ chi tiết *"
        value={line1}
        onChangeText={setLine1}
        placeholder="Số nhà, tên đường"
        error={localError && line1.trim().length < 3 ? localError : submit.fields['proposedPlace.address.line1']}
      />
      <SelectField
        label="Tỉnh / Thành phố *"
        value={provinceCode}
        options={provinceOptions}
        onChange={next => {
          setProvinceCode(next);
          setWardCode('');
        }}
      />
      {wardOptions.length > 0 && (
        <SelectField
          label="Phường / Xã"
          value={wardCode || undefined}
          options={wardOptions}
          placeholder="Không bắt buộc"
          onChange={setWardCode}
        />
      )}
      <Card style={styles.infoCard}>
        <AppText variant="label">Vị trí tọa độ</AppText>
        <AppText variant="caption" muted>
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </AppText>
        <Button variant="secondary" title="Chọn vị trí trên bản đồ" onPress={() => setStep('map')} />
      </Card>

      <SelectField label="Độ yên tĩnh" value={quietLevel} options={QUIET_OPTIONS} onChange={setQuietLevel} />
      <SelectField label="Phù hợp học tập" value={studySuitability} options={SUITABILITY_OPTIONS} onChange={setStudySuitability} />

      <TextField
        label="Số điện thoại (tùy chọn)"
        value={phone}
        onChangeText={setPhone}
        placeholder="+84901234567"
      />
      <TextField
        label="Mô tả ngắn"
        value={description}
        onChangeText={setDescription}
        multiline
        textAlignVertical="top"
        style={styles.textarea}
        placeholder="Điểm nổi bật về Wi-Fi, ổ cắm, bàn ghế…"
      />

      {localError || dupSubmit.message ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {localError ?? dupSubmit.message}
        </AppText>
      ) : null}

      <Button
        title="Tiếp tục (Kiểm tra trùng)"
        loading={dupSubmit.pending}
        onPress={validateAndCheckDuplicates}
      />
    </View>
  );
}

function currentFieldValue(place: Place, path: string): string {
  if (path === 'address.line1') {
    return place.address.line1;
  }
  const val = (place as unknown as Record<string, unknown>)[path];
  return val === undefined || val === null ? '' : String(val);
}

// U23 (Goi y sua dia diem) + U24 (Chon truong khong bi khoa) + U25 (Xac nhan gui)
export function UpdateSuggestionModal({ place }: { place: Place }) {
  const manager = useSessionManager();
  const queryClient = useQueryClient();
  const { open, setDirty } = useModal();
  const toast = useToast();
  const submit = useSubmit();
  const api = useMemo(() => placesApi(manager), [manager]);
  const idemKeyRef = useRef(`suggest-update-${place.id}-${Date.now()}`);

  const lockedPaths = useMemo(
    () => new Set((place.fieldStates ?? []).filter(fs => fs.locked).map(fs => fs.path)),
    [place.fieldStates],
  );

  const [step, setStep] = useState<'pick' | 'edit' | 'confirm'>('pick');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string>();

  const isDirty = selectedPaths.length > 0;
  useDirtyGuard(isDirty);

  const togglePath = (path: string) => {
    if (lockedPaths.has(path)) {
      return;
    }
    setSelectedPaths(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      }
      setValues(v => ({ ...v, [path]: v[path] ?? currentFieldValue(place, path) }));
      return [...prev, path];
    });
  };

  const buildChanges = (): SuggestionChange[] =>
    selectedPaths.map(path => ({
      fieldPath: path,
      oldValue: currentFieldValue(place, path),
      newValue: (values[path] ?? '').trim(),
      reason: (reasons[path] ?? '').trim(),
    }));

  const goConfirm = () => {
    for (const path of selectedPaths) {
      if ((values[path] ?? '').trim().length === 0) {
        setLocalError('Vui lòng nhập giá trị mới cho tất cả các trường đã chọn.');
        return;
      }
      if ((reasons[path] ?? '').trim().length < 10) {
        setLocalError('Lý do chỉnh sửa cho mỗi trường cần tối thiểu 10 ký tự.');
        return;
      }
    }
    setLocalError(undefined);
    setStep('confirm');
  };

  const onSubmit = async () => {
    const payload: SuggestionCreate = {
      type: 'UPDATE',
      placeId: place.id,
      changes: buildChanges(),
    };
    const created = await submit.run(() => api.createSuggestion(payload, idemKeyRef.current));
    if (created) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.suggestions.all });
      setDirty(false);
      toast('Đã gửi gợi ý chỉnh sửa thông tin địa điểm.');
      open({ name: 'feature', feature: 'suggestions' });
    }
  };

  // U24 - Chon truong muon sua
  if (step === 'pick') {
    return (
      <View style={styles.section}>
        <AppText variant="heading">Chọn thông tin cần cập nhật</AppText>
        <AppText muted>Địa điểm: {place.name} ({formatAddress(place.address)})</AppText>
        {SUGGESTABLE_FIELDS.map(field => {
          const locked = lockedPaths.has(field.path) || lockedPaths.has(field.path.split('.')[0]);
          const active = selectedPaths.includes(field.path);
          return (
            <Pressable
              key={field.path}
              accessibilityRole="checkbox"
              accessibilityLabel={field.label}
              accessibilityState={{ checked: active, disabled: locked }}
              disabled={locked}
              style={[styles.fieldRow, active && styles.fieldRowActive, locked && styles.fieldRowLocked]}
              onPress={() => togglePath(field.path)}
            >
              <View style={styles.grow}>
                <AppText variant="label">{field.label}</AppText>
                <AppText variant="caption" muted>
                  {locked ? 'Đã được quản trị viên khóa chỉnh sửa' : `Hiện tại: ${currentFieldValue(place, field.path) || '(trống)'}`}
                </AppText>
              </View>
              {locked ? (
                <Lock size={18} color={colors.muted} />
              ) : active ? (
                <Check size={18} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
        <Button
          title={`Tiếp tục (${selectedPaths.length} trường)`}
          disabled={selectedPaths.length === 0}
          onPress={() => setStep('edit')}
        />
      </View>
    );
  }

  // U25 - Xac nhan gui goi y
  if (step === 'confirm') {
    const changes = buildChanges();
    return (
      <View style={styles.section}>
        <AppText variant="heading">Xác nhận gợi ý chỉnh sửa</AppText>
        {changes.map(ch => {
          const meta = SUGGESTABLE_FIELDS.find(f => f.path === ch.fieldPath);
          return (
            <Card key={ch.fieldPath} style={styles.infoCard}>
              <AppText variant="label">{meta?.label ?? ch.fieldPath}</AppText>
              <AppText variant="caption" muted>Cũ: {String(ch.oldValue || '—')}</AppText>
              <AppText>Mới: {String(ch.newValue)}</AppText>
              <AppText variant="caption" muted>Lý do: {ch.reason}</AppText>
            </Card>
          );
        })}
        {submit.message ? (
          <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
            {submit.message}
          </AppText>
        ) : null}
        <Button title="Xác nhận gửi gợi ý" loading={submit.pending} onPress={onSubmit} />
        <Button variant="ghost" title="Quay lại sửa" onPress={() => setStep('edit')} />
      </View>
    );
  }

  // U23 - Nhap gia tri moi + ly do cho tung truong
  return (
    <View style={styles.section}>
      <AppText variant="heading">Nhập thông tin cập nhật</AppText>
      {selectedPaths.map(path => {
        const meta = SUGGESTABLE_FIELDS.find(f => f.path === path);
        return (
          <Card key={path} style={styles.infoCard}>
            <AppText variant="label">{meta?.label ?? path}</AppText>
            <TextField
              label={`Giá trị mới (${meta?.label ?? path})`}
              value={values[path] ?? ''}
              onChangeText={val => setValues(prev => ({ ...prev, [path]: val }))}
              placeholder={meta?.placeholder}
            />
            <TextField
              label={`Lý do cập nhật (${meta?.label ?? path})`}
              value={reasons[path] ?? ''}
              onChangeText={val => setReasons(prev => ({ ...prev, [path]: val }))}
              placeholder="Tối thiểu 10 ký tự (vd: bảng hiệu/fanpage mới cập nhật)"
            />
          </Card>
        );
      })}
      {localError ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" style={styles.error}>
          {localError}
        </AppText>
      ) : null}
      <Button title="Xem trước & xác nhận" onPress={goConfirm} />
      <Button variant="ghost" title="← Chọn lại trường" onPress={() => setStep('pick')} />
    </View>
  );
}

// U26 - Danh sach de xuat cua toi (thay pending feature 'suggestions')
export function MySuggestionsModal() {
  const { open } = useModal();
  const query = usePagedQuery<Suggestion>(
    queryKeys.suggestions.mine(),
    '/users/me/place-suggestions',
    {},
    { authenticated: true },
  );

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Button title="+ Đề xuất địa điểm mới" onPress={() => open({ name: 'suggestion-create' })} />
      </View>
      <PagedList
        query={query}
        keyExtractor={item => item.id}
        emptyTitle="Bạn chưa gửi đề xuất nào"
        emptyDescription="Đóng góp địa điểm học tập mới hoặc gợi ý sửa thông tin chưa chính xác."
        renderItem={item => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xem đề xuất ${item.proposedPlace?.name ?? item.placeName ?? item.id}`}
            onPress={() => open({ name: 'suggestion-detail', suggestionId: item.id })}
          >
            <Card style={styles.infoCard}>
              <View style={styles.rowBetween}>
                <Chip label={SUGGESTION_TYPE_LABEL[item.type]} />
                <Chip
                  label={SUGGESTION_STATUS_LABEL[item.status]}
                  selected={item.status === 'APPROVED'}
                />
              </View>
              <AppText variant="heading">
                {item.proposedPlace?.name ?? item.placeName ?? `Đề xuất #${item.id.slice(-6)}`}
              </AppText>
              <AppText variant="caption" muted>
                Gửi ngày {new Date(item.createdAt).toLocaleDateString('vi-VN')}
              </AppText>
              {item.status === 'REJECTED' && item.rejectionReason ? (
                <AppText variant="caption" style={styles.error} numberOfLines={2}>
                  Lý do từ chối: {item.rejectionReason}
                </AppText>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

// U27 - Chi tiet de xuat cua toi (trang thai + rejectionReason)
export function SuggestionDetailModal({ suggestionId }: { suggestionId: string }) {
  const { open } = useModal();
  const query = useApiQuery<Suggestion>(
    queryKeys.suggestions.detail(suggestionId),
    `/users/me/place-suggestions/${suggestionId}`,
    { authenticated: true },
  );

  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message={query.error?.message ?? 'Không tải được chi tiết đề xuất.'}
        onRetry={() => query.refetch()}
      />
    );
  }
  const s = query.data;
  return (
    <View style={styles.section}>
      <View style={styles.chips}>
        <Chip label={SUGGESTION_TYPE_LABEL[s.type]} />
        <Chip label={SUGGESTION_STATUS_LABEL[s.status]} selected={s.status === 'APPROVED'} />
      </View>

      <AppText variant="heading">
        {s.proposedPlace?.name ?? s.placeName ?? `Đề xuất #${s.id.slice(-6)}`}
      </AppText>
      <AppText variant="caption" muted>
        Ngày gửi: {new Date(s.createdAt).toLocaleDateString('vi-VN')}
        {s.reviewedAt ? ` · Xử lý: ${new Date(s.reviewedAt).toLocaleDateString('vi-VN')}` : ''}
      </AppText>

      {s.status === 'REJECTED' && s.rejectionReason ? (
        <Card style={styles.rejectCard}>
          <AppText variant="label" style={styles.error}>Lý do từ chối từ quản trị viên</AppText>
          <AppText style={styles.error}>{s.rejectionReason}</AppText>
        </Card>
      ) : null}

      {s.type === 'CREATE' && s.proposedPlace && (
        <Card style={styles.infoCard}>
          <AppText variant="label">Thông tin đề xuất</AppText>
          <AppText>{PLACE_CATEGORY_LABEL[s.proposedPlace.category]}</AppText>
          <AppText muted>{formatAddress(s.proposedPlace.address)}</AppText>
          {s.proposedPlace.description ? <AppText muted>{s.proposedPlace.description}</AppText> : null}
        </Card>
      )}

      {s.type === 'UPDATE' && s.changes && s.changes.length > 0 && (
        <View style={styles.section}>
          {s.changes.map((ch, idx) => (
            <Card key={`${ch.fieldPath}-${idx}`} style={styles.infoCard}>
              <AppText variant="label">{ch.fieldPath}</AppText>
              <AppText variant="caption" muted>Cũ: {String(ch.oldValue ?? '—')}</AppText>
              <AppText>Đề xuất: {String(ch.newValue)}</AppText>
              <AppText variant="caption" muted>Lý do: {ch.reason}</AppText>
            </Card>
          ))}
        </View>
      )}

      {s.placeId ? (
        <Button
          variant="secondary"
          title="Mở địa điểm liên quan"
          onPress={() => open({ name: 'place-detail', placeId: s.placeId! })}
        />
      ) : null}
      <Button
        variant="ghost"
        title="← Danh sách đề xuất của tôi"
        onPress={() => open({ name: 'feature', feature: 'suggestions' })}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  section: { gap: 14 },
  infoCard: { gap: 8 },
  dupCard: { gap: 8, backgroundColor: colors.primarySoft },
  rejectCard: { gap: 6, backgroundColor: colors.errorSoft, borderColor: colors.error },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grow: { flex: 1 },
  fieldRow: {
    padding: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  fieldRowLocked: { opacity: 0.55 },
  textarea: { minHeight: 100 },
  error: { color: colors.error },
});
