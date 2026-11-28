import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Page } from '@contracts/api';
import type {
  AttributeDefinition,
  AttributeDefinitionWrite,
  AttributePrimitiveValue,
  AttributeType,
  AttributeValue,
  PlaceCategory,
} from '@contracts/places';
import { PermissionGate } from '../../../auth/guards';
import { api } from '../../../lib/api';
import { queryKeys, useApiQuery } from '../../../lib/query';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  ModalCancel,
  SelectField,
  TextField,
  useSubmit,
  useToast,
} from '../../../ui';
import { ATTRIBUTE_TYPE_LABEL, ATTRIBUTE_TYPE_OPTIONS, PLACE_CATEGORY_LABEL, PLACE_CATEGORY_OPTIONS } from '../placeLabels';

// A20 - Chinh sua gia tri thuoc tinh dong & quan ly dinh nghia thuoc tinh
export function AttributeEditorModal({
  category,
  values,
  onSaveValues,
  onClose,
}: {
  category: PlaceCategory;
  values: AttributeValue[];
  onSaveValues: (next: AttributeValue[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'values' | 'definitions'>('values');
  const [draft, setDraft] = useState<Map<string, AttributePrimitiveValue>>(
    () => new Map(values.map(v => [v.definitionId, v.value])),
  );

  const defsQuery = useApiQuery<Page<AttributeDefinition>>(
    queryKeys.placeAttributes.admin({ limit: 100 }),
    '/admin/place-attributes',
    { query: { limit: 100 } },
  );

  const applicableDefs = (defsQuery.data?.items ?? []).filter(
    def => def.active && (!def.category || def.category === category),
  );

  const setVal = (id: string, val: AttributePrimitiveValue | undefined) => {
    setDraft(prev => {
      const next = new Map(prev);
      if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
        next.delete(id);
      } else {
        next.set(id, val);
      }
      return next;
    });
  };

  const handleSaveValues = () => {
    const list: AttributeValue[] = [];
    for (const [definitionId, value] of draft.entries()) {
      list.push({ definitionId, value });
    }
    onSaveValues(list);
    onClose();
  };

  return (
    <Modal title="Thuộc tính mở rộng của địa điểm" size="L" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'values'} onClick={() => setTab('values')}>
          Giá trị áp dụng ({draft.size})
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'definitions'} onClick={() => setTab('definitions')}>
          Quản lý định nghĩa thuộc tính
        </button>
      </div>

      {defsQuery.isPending && <LoadingState />}
      {defsQuery.error && <ErrorState error={defsQuery.error} onRetry={() => void defsQuery.refetch()} />}

      {!defsQuery.isPending && !defsQuery.error && tab === 'values' && (
        <div className="form">
          {applicableDefs.length === 0 ? (
            <EmptyState
              title="Chưa có thuộc tính khả dụng cho danh mục này"
              description="Chuyển sang tab Quản lý định nghĩa thuộc tính để thêm mới."
            />
          ) : (
            applicableDefs.map(def => {
              const current = draft.get(def.id);
              if (def.type === 'BOOLEAN') {
                return (
                  <Checkbox
                    key={def.id}
                    label={`${def.label}${def.required ? ' *' : ''}`}
                    checked={Boolean(current)}
                    onChange={e => setVal(def.id, e.target.checked)}
                  />
                );
              }
              if (def.type === 'NUMBER') {
                return (
                  <TextField
                    key={def.id}
                    type="number"
                    label={`${def.label}${def.unit ? ` (${def.unit})` : ''}${def.required ? ' *' : ''}`}
                    value={typeof current === 'number' ? String(current) : ''}
                    onChange={e => setVal(def.id, e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                );
              }
              if (def.type === 'SINGLE_SELECT') {
                return (
                  <SelectField
                    key={def.id}
                    label={`${def.label}${def.required ? ' *' : ''}`}
                    placeholder="Chưa chọn"
                    options={(def.options ?? []).map(o => ({ value: o, label: o }))}
                    value={typeof current === 'string' ? current : ''}
                    onChange={e => setVal(def.id, e.target.value || undefined)}
                  />
                );
              }
              if (def.type === 'MULTI_SELECT') {
                const selected = Array.isArray(current) ? current : [];
                return (
                  <div className="field" key={def.id}>
                    <span className="label">{def.label}{def.required ? ' *' : ''}</span>
                    <div className="chip-row">
                      {(def.options ?? []).map(opt => {
                        const active = selected.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            className="chip-toggle"
                            aria-pressed={active}
                            onClick={() =>
                              setVal(
                                def.id,
                                active ? selected.filter(x => x !== opt) : [...selected, opt],
                              )
                            }
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return (
                <TextField
                  key={def.id}
                  label={`${def.label}${def.unit ? ` (${def.unit})` : ''}${def.required ? ' *' : ''}`}
                  value={typeof current === 'string' ? current : ''}
                  onChange={e => setVal(def.id, e.target.value)}
                />
              );
            })
          )}
          <div className="modal-actions">
            <ModalCancel />
            <Button onClick={handleSaveValues}>Áp dụng giá trị</Button>
          </div>
        </div>
      )}

      {!defsQuery.isPending && !defsQuery.error && tab === 'definitions' && (
        <DefinitionsManager definitions={defsQuery.data?.items ?? []} />
      )}
    </Modal>
  );
}

function DefinitionsManager({ definitions }: { definitions: AttributeDefinition[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const submit = useSubmit();
  const [editing, setEditing] = useState<AttributeDefinition | 'new'>();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<AttributeType>('TEXT');
  const [optionsText, setOptionsText] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<PlaceCategory | ''>('');
  const [required, setRequired] = useState(false);
  const [filterable, setFilterable] = useState(true);
  const [active, setActive] = useState(true);

  const openNew = () => {
    setEditing('new');
    setKey('');
    setLabel('');
    setType('TEXT');
    setOptionsText('');
    setUnit('');
    setCategory('');
    setRequired(false);
    setFilterable(true);
    setActive(true);
    submit.reset();
  };

  const openEdit = (def: AttributeDefinition) => {
    setEditing(def);
    setKey(def.key);
    setLabel(def.label);
    setType(def.type);
    setOptionsText((def.options ?? []).join(', '));
    setUnit(def.unit ?? '');
    setCategory(def.category ?? '');
    setRequired(def.required);
    setFilterable(def.filterable);
    setActive(def.active);
    submit.reset();
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const options =
      type === 'SINGLE_SELECT' || type === 'MULTI_SELECT'
        ? optionsText.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
    const payload: AttributeDefinitionWrite = {
      key: key.trim(),
      label: label.trim(),
      type,
      ...(options ? { options } : {}),
      ...(unit.trim() ? { unit: unit.trim() } : {}),
      ...(category ? { category } : {}),
      required,
      filterable,
      active,
    };

    const result = await submit.run(() =>
      editing === 'new'
        ? api.request<AttributeDefinition>('/admin/place-attributes', { method: 'POST', body: payload })
        : api.request<AttributeDefinition>(`/admin/place-attributes/${(editing as AttributeDefinition).id}`, {
            method: 'PATCH',
            body: payload,
          }),
    );
    if (result) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.placeAttributes.all });
      toast(editing === 'new' ? 'Đã tạo thuộc tính mới.' : 'Đã cập nhật thuộc tính.');
      setEditing(undefined);
    }
  };

  return (
    <div className="form">
      <PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}>
        {!editing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button small onClick={openNew}>+ Thêm định nghĩa thuộc tính</Button>
          </div>
        )}
      </PermissionGate>

      {editing && (
        <form className="card form" onSubmit={onSave} noValidate>
          <h3>{editing === 'new' ? 'Tạo định nghĩa thuộc tính' : `Chỉnh sửa: ${editing.label}`}</h3>
          <div className="form-grid">
            <TextField
              label="Mã (key)"
              value={key}
              onChange={e => setKey(e.target.value)}
              disabled={editing !== 'new'}
              placeholder="vd: wifi_speed_mbps"
              error={submit.fields.key}
            />
            <TextField
              label="Tên hiển thị"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="vd: Tốc độ Wi-Fi"
              error={submit.fields.label}
            />
            <SelectField
              label="Kiểu dữ liệu"
              value={type}
              onChange={e => setType(e.target.value as AttributeType)}
              options={ATTRIBUTE_TYPE_OPTIONS}
              error={submit.fields.type}
            />
            <SelectField
              label="Danh mục áp dụng"
              placeholder="Tất cả danh mục"
              value={category}
              onChange={e => setCategory(e.target.value as PlaceCategory | '')}
              options={PLACE_CATEGORY_OPTIONS}
            />
            <TextField
              label="Đơn vị (tùy chọn)"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="vd: Mbps, chỗ ngồi"
            />
            {(type === 'SINGLE_SELECT' || type === 'MULTI_SELECT') && (
              <TextField
                label="Danh sách lựa chọn (phân tách bởi dấu phẩy)"
                value={optionsText}
                onChange={e => setOptionsText(e.target.value)}
                placeholder="vd: Ít, Vừa, Nhiều"
                error={submit.fields.options}
              />
            )}
          </div>
          <div className="toolbar">
            <Checkbox label="Cho phép lọc công khai" checked={filterable} onChange={e => setFilterable(e.target.checked)} />
            <Checkbox label="Bắt buộc" checked={required} onChange={e => setRequired(e.target.checked)} />
            <Checkbox label="Đang hoạt động" checked={active} onChange={e => setActive(e.target.checked)} />
          </div>
          {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setEditing(undefined)}>Hủy</Button>
            <Button type="submit" loading={submit.pending}>Lưu định nghĩa</Button>
          </div>
        </form>
      )}

      {definitions.length === 0 ? (
        <EmptyState title="Chưa có định nghĩa thuộc tính nào" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Thuộc tính</th>
                <th>Kiểu</th>
                <th>Phạm vi</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {definitions.map(def => (
                <tr key={def.id}>
                  <td>
                    <strong>{def.label}</strong>
                    <div className="muted">{def.key}{def.unit ? ` · ${def.unit}` : ''}</div>
                  </td>
                  <td>{ATTRIBUTE_TYPE_LABEL[def.type]}</td>
                  <td>{def.category ? PLACE_CATEGORY_LABEL[def.category] : 'Tất cả'}</td>
                  <td>
                    <Badge tone={def.active ? 'success' : 'neutral'}>
                      {def.active ? 'Hoạt động' : 'Tạm ngưng'}
                    </Badge>
                  </td>
                  <td>
                    <PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}>
                      <Button variant="secondary" small onClick={() => openEdit(def)}>Sửa</Button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
