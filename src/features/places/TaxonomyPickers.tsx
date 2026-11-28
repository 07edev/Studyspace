import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { useModal } from '../../navigation/ModalCoordinator';
import { useSession, useSessionManager } from '../../shared/auth/AuthProvider';
import type { TaxonomyItem } from '../../shared/contracts/places';
import { queryKeys, usePagedQuery } from '../../shared/query';
import { colors, radii } from '../../shared/theme/tokens';
import { AppText, Button, PagedList, TextField, useToast } from '../../shared/ui';
import { useSubmit } from '../auth/formHooks';
import { profileApi } from '../profile/profileApi';
import { useExplore } from './ExploreContext';

const MAX_SUBJECTS = 30;

// U07 - Chon truong dai hoc & nganh hoc (searchable PagedList, no nested ScrollView)
export function UniversityMajorPickerModal({ returnToProfile = true }: { returnToProfile?: boolean }) {
  const manager = useSessionManager();
  const { user } = useSession();
  const { open, close } = useModal();
  const toast = useToast();
  const submit = useSubmit();
  const api = useMemo(() => profileApi(manager), [manager]);

  const [step, setStep] = useState<'university' | 'major'>('university');
  const [search, setSearch] = useState('');
  const [selectedUni, setSelectedUni] = useState<TaxonomyItem>();
  const [selectedMajor, setSelectedMajor] = useState<TaxonomyItem>();

  const q = search.trim();
  const uniQuery = usePagedQuery<TaxonomyItem>(
    queryKeys.taxonomy.universities(q),
    '/taxonomies/universities',
    q ? { q } : {},
    { authenticated: false, enabled: step === 'university', limit: 30 },
  );
  const majorQuery = usePagedQuery<TaxonomyItem>(
    queryKeys.taxonomy.majors(selectedUni?.id, q),
    '/taxonomies/majors',
    { ...(selectedUni?.id ? { universityId: selectedUni.id } : {}), ...(q ? { q } : {}) },
    { authenticated: false, enabled: step === 'major', limit: 30 },
  );

  const finish = () => {
    if (returnToProfile) {
      open({ name: 'profile-edit' });
    } else {
      close();
    }
  };

  const onSave = async () => {
    if (!selectedUni) {
      return;
    }
    const saved = await submit.run(() =>
      api.patchProfile({
        universityId: selectedUni.id,
        majorId: selectedMajor?.id ?? null,
      }),
    );
    if (saved) {
      manager.setUser(saved);
      toast('Đã cập nhật trường và ngành học.');
      finish();
    }
  };

  const currentQuery = step === 'university' ? uniQuery : majorQuery;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TextField
          label={step === 'university' ? 'Tìm trường đại học / cao đẳng' : `Tìm ngành tại ${selectedUni?.name ?? ''}`}
          value={search}
          onChangeText={setSearch}
          placeholder="Nhập tên trường hoặc mã…"
        />
        {step === 'major' && (
          <View style={styles.rowBetween}>
            <AppText variant="caption" muted style={styles.grow}>
              Trường đã chọn: {selectedUni?.name}
            </AppText>
            <Button
              variant="ghost"
              title="Đổi trường"
              onPress={() => {
                setStep('university');
                setSearch('');
              }}
            />
          </View>
        )}
      </View>

      <PagedList
        query={currentQuery}
        keyExtractor={item => item.id}
        emptyTitle={step === 'university' ? 'Không tìm thấy trường phù hợp' : 'Chưa có danh sách ngành cho trường này'}
        renderItem={item => {
          const active =
            step === 'university'
              ? (selectedUni?.id ?? user?.profile.universityId) === item.id
              : (selectedMajor?.id ?? user?.profile.majorId) === item.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={[styles.itemRow, active && styles.itemRowActive]}
              onPress={() => {
                if (step === 'university') {
                  setSelectedUni(item);
                  setSelectedMajor(undefined);
                  setSearch('');
                  setStep('major');
                } else {
                  setSelectedMajor(item);
                }
              }}
            >
              <View style={styles.grow}>
                <AppText variant="label">{item.name}</AppText>
                <AppText variant="caption" muted>{item.code}</AppText>
              </View>
              {active ? <Check size={18} color={colors.primary} /> : <ChevronRight size={18} color={colors.muted} />}
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        {submit.message ? (
          <AppText variant="caption" style={styles.error}>{submit.message}</AppText>
        ) : null}
        <View style={styles.actions}>
          <Button variant="ghost" title="Quay lại" onPress={finish} />
          <Button
            title="Lưu trường & ngành"
            disabled={!selectedUni}
            loading={submit.pending}
            onPress={onSave}
          />
        </View>
      </View>
    </View>
  );
}

// U08 - Chon mon hoc quan tam (multi-select toi da 30 mon)
export function SubjectsPickerModal({ returnToProfile = true }: { returnToProfile?: boolean }) {
  const manager = useSessionManager();
  const { user } = useSession();
  const { open, close } = useModal();
  const toast = useToast();
  const submit = useSubmit();
  const api = useMemo(() => profileApi(manager), [manager]);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => user?.profile.subjectIds ?? []);
  const [limitMsg, setLimitMsg] = useState<string>();

  const q = search.trim();
  const query = usePagedQuery<TaxonomyItem>(
    queryKeys.taxonomy.subjects(q),
    '/taxonomies/subjects',
    q ? { q } : {},
    { authenticated: false, limit: 30 },
  );

  const toggle = (id: string) => {
    setLimitMsg(undefined);
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= MAX_SUBJECTS) {
        setLimitMsg(`Chỉ chọn tối đa ${MAX_SUBJECTS} môn học quan tâm.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const finish = () => {
    if (returnToProfile) {
      open({ name: 'profile-edit' });
    } else {
      close();
    }
  };

  const onSave = async () => {
    const saved = await submit.run(() => api.patchProfile({ subjectIds: selectedIds }));
    if (saved) {
      manager.setUser(saved);
      toast(`Đã lưu ${selectedIds.length} môn học quan tâm.`);
      finish();
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TextField
          label={`Tìm môn học (${selectedIds.length}/${MAX_SUBJECTS})`}
          value={search}
          onChangeText={setSearch}
          placeholder="vd: Giải tích, Cấu trúc dữ liệu, IELTS…"
        />
        {limitMsg ? <AppText variant="caption" style={styles.error}>{limitMsg}</AppText> : null}
      </View>

      <PagedList
        query={query}
        keyExtractor={item => item.id}
        emptyTitle="Không tìm thấy môn học phù hợp"
        renderItem={item => {
          const active = selectedIds.includes(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityState={{ selected: active }}
              style={[styles.itemRow, active && styles.itemRowActive]}
              onPress={() => toggle(item.id)}
            >
              <View style={styles.grow}>
                <AppText variant="label">{item.name}</AppText>
                <AppText variant="caption" muted>{item.code}</AppText>
              </View>
              {active && <Check size={18} color={colors.primary} />}
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        {submit.message ? (
          <AppText variant="caption" style={styles.error}>{submit.message}</AppText>
        ) : null}
        <View style={styles.actions}>
          <Button variant="ghost" title="Quay lại" onPress={finish} />
          <Button
            title={`Lưu (${selectedIds.length})`}
            loading={submit.pending}
            onPress={onSave}
          />
        </View>
      </View>
    </View>
  );
}

const PROVINCE_CENTERS: Record<string, { lat: number; lng: number }> = {
  '79': { lat: 10.7769, lng: 106.7009 },
  '01': { lat: 21.0285, lng: 105.8542 },
  '48': { lat: 16.0544, lng: 108.2022 },
  '92': { lat: 10.0452, lng: 105.7469 },
  '46': { lat: 16.4637, lng: 107.5909 },
};

// U09 - Chon khu vuc (Tinh/Thanh pho & Phuong/Xa)
export function LocationPickerModal() {
  const { location, setLocation } = useExplore();
  const { close } = useModal();
  const toast = useToast();
  const [step, setStep] = useState<'province' | 'ward'>('province');
  const [pickedProvince, setPickedProvince] = useState<TaxonomyItem>();

  const provincesQuery = usePagedQuery<TaxonomyItem>(
    queryKeys.taxonomy.provinces(),
    '/locations/provinces',
    {},
    { authenticated: false, enabled: step === 'province', limit: 100 },
  );
  const wardsQuery = usePagedQuery<TaxonomyItem>(
    queryKeys.taxonomy.wards(pickedProvince?.code ?? ''),
    '/locations/wards',
    pickedProvince ? { provinceCode: pickedProvince.code } : {},
    { authenticated: false, enabled: step === 'ward' && Boolean(pickedProvince), limit: 100 },
  );

  const applyProvinceOnly = () => {
    if (!pickedProvince) {
      return;
    }
    setLocation({
      provinceCode: pickedProvince.code,
      provinceName: pickedProvince.name,
      coords: PROVINCE_CENTERS[pickedProvince.code],
    });
    toast(`Đã chọn khu vực ${pickedProvince.name}.`);
    close();
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.rowBetween}>
          <AppText variant="caption" muted style={styles.grow}>
            {step === 'province'
              ? 'Chọn Tỉnh / Thành phố để ưu tiên gợi ý địa điểm gần khu vực của bạn.'
              : `Đang chọn Phường / Xã thuộc ${pickedProvince?.name}`}
          </AppText>
          {location.provinceCode ? (
            <Button
              variant="ghost"
              title="Bỏ lọc khu vực"
              onPress={() => {
                setLocation({});
                toast('Đã đặt lại khu vực mặc định.');
                close();
              }}
            />
          ) : null}
        </View>
        {step === 'ward' && (
          <View style={styles.actions}>
            <Button variant="ghost" title="← Đổi tỉnh/thành" onPress={() => setStep('province')} />
            <Button variant="secondary" title={`Toàn ${pickedProvince?.name ?? ''}`} onPress={applyProvinceOnly} />
          </View>
        )}
      </View>

      <PagedList
        query={step === 'province' ? provincesQuery : wardsQuery}
        keyExtractor={item => item.id}
        emptyTitle="Chưa có dữ liệu địa giới"
        renderItem={item => {
          const active =
            step === 'province'
              ? location.provinceCode === item.code
              : location.wardCode === item.code;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={[styles.itemRow, active && styles.itemRowActive]}
              onPress={() => {
                if (step === 'province') {
                  setPickedProvince(item);
                  setStep('ward');
                } else {
                  setLocation({
                    provinceCode: pickedProvince?.code,
                    provinceName: pickedProvince?.name,
                    wardCode: item.code,
                    wardName: item.name,
                    coords: pickedProvince ? PROVINCE_CENTERS[pickedProvince.code] : undefined,
                  });
                  toast(`Đã chọn ${item.name}, ${pickedProvince?.name ?? ''}.`);
                  close();
                }
              }}
            >
              <AppText variant="label" style={styles.grow}>{item.name}</AppText>
              {active ? <Check size={18} color={colors.primary} /> : <ChevronRight size={18} color={colors.muted} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  itemRow: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  error: { color: colors.error },
});
