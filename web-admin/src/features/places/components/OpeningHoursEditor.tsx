import { useState } from 'react';
import type { DayOfWeek, OpeningDay, OpeningInterval } from '@contracts/places';
import { Button, Checkbox, Modal, ModalCancel } from '../../../ui';
import { DAY_OF_WEEK_LABEL, DAY_OF_WEEK_ORDER, defaultOpeningHours } from '../placeLabels';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeDays(input: OpeningDay[]): OpeningDay[] {
  const byDay = new Map(input.map(item => [item.day, item]));
  return DAY_OF_WEEK_ORDER.map(day => {
    const found = byDay.get(day);
    if (found) {
      return {
        day,
        closed: found.closed,
        intervals: found.intervals.map(i => ({ ...i })),
      };
    }
    return { day, closed: true, intervals: [] };
  });
}

// A19 - Chinh sua gio mo cua 7 ngay (toi da 3 khung gio/ngay, ho tro qua dem)
export function OpeningHoursModal({
  value,
  onSave,
  onClose,
}: {
  value: OpeningDay[];
  onSave: (next: OpeningDay[]) => void;
  onClose: () => void;
}) {
  const initial = value.length > 0 ? normalizeDays(value) : defaultOpeningHours();
  const [days, setDays] = useState<OpeningDay[]>(initial);
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(days) !== JSON.stringify(initial);

  const updateDay = (day: DayOfWeek, updater: (current: OpeningDay) => OpeningDay) => {
    setDays(prev => prev.map(item => (item.day === day ? updater(item) : item)));
  };

  const updateInterval = (day: DayOfWeek, idx: number, patch: Partial<OpeningInterval>) => {
    updateDay(day, current => ({
      ...current,
      intervals: current.intervals.map((iv, i) => (i === idx ? { ...iv, ...patch } : iv)),
    }));
  };

  const applyMondayToAll = () => {
    const monday = days.find(d => d.day === 'MON');
    if (!monday) return;
    setDays(prev =>
      prev.map(d => ({
        day: d.day,
        closed: monday.closed,
        intervals: monday.intervals.map(i => ({ ...i })),
      })),
    );
  };

  const handleSave = () => {
    for (const d of days) {
      if (d.closed) continue;
      if (d.intervals.length === 0) {
        setError(`${DAY_OF_WEEK_LABEL[d.day]} đang mở cửa nhưng chưa có khung giờ.`);
        return;
      }
      for (const iv of d.intervals) {
        if (!HHMM.test(iv.open) || !HHMM.test(iv.close)) {
          setError(`${DAY_OF_WEEK_LABEL[d.day]}: giờ phải theo định dạng HH:mm (vd: 08:00).`);
          return;
        }
        if (!iv.overnight && iv.open >= iv.close) {
          setError(`${DAY_OF_WEEK_LABEL[d.day]}: giờ đóng phải sau giờ mở (hoặc bật Qua đêm).`);
          return;
        }
      }
    }
    setError(undefined);
    onSave(days.map(d => (d.closed ? { day: d.day, closed: true, intervals: [] } : d)));
    onClose();
  };

  return (
    <Modal title="Thiết lập giờ mở cửa" size="L" onClose={onClose} dirty={dirty}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <p className="muted">Múi giờ Việt Nam (UTC+7). Mỗi ngày mở tối đa 3 khung giờ.</p>
        <Button variant="secondary" small onClick={applyMondayToAll}>
          Áp dụng Thứ 2 cho cả tuần
        </Button>
      </div>

      <div className="hours-list">
        {days.map(d => (
          <div className="hours-row" key={d.day}>
            <strong>{DAY_OF_WEEK_LABEL[d.day]}</strong>
            <Checkbox
              label="Đóng cửa"
              checked={d.closed}
              onChange={e => {
                const closed = e.target.checked;
                updateDay(d.day, cur => ({
                  ...cur,
                  closed,
                  intervals: closed ? [] : cur.intervals.length > 0 ? cur.intervals : [{ open: '08:00', close: '22:00', overnight: false }],
                }));
              }}
            />
            <div>
              {d.closed ? (
                <span className="muted">Nghỉ cả ngày</span>
              ) : (
                <>
                  {d.intervals.map((iv, idx) => (
                    <div className="interval-row" key={idx}>
                      <input
                        className="input"
                        type="text"
                        aria-label={`${DAY_OF_WEEK_LABEL[d.day]} giờ mở ${idx + 1}`}
                        placeholder="08:00"
                        value={iv.open}
                        onChange={e => updateInterval(d.day, idx, { open: e.target.value })}
                      />
                      <span>–</span>
                      <input
                        className="input"
                        type="text"
                        aria-label={`${DAY_OF_WEEK_LABEL[d.day]} giờ đóng ${idx + 1}`}
                        placeholder="22:00"
                        value={iv.close}
                        onChange={e => updateInterval(d.day, idx, { close: e.target.value })}
                      />
                      <label className="checkbox" style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(iv.overnight)}
                          onChange={e => updateInterval(d.day, idx, { overnight: e.target.checked })}
                        />
                        <span>Qua đêm</span>
                      </label>
                      {d.intervals.length > 1 && (
                        <Button
                          variant="ghost"
                          small
                          onClick={() =>
                            updateDay(d.day, cur => ({
                              ...cur,
                              intervals: cur.intervals.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Xóa
                        </Button>
                      )}
                    </div>
                  ))}
                  {d.intervals.length < 3 && (
                    <Button
                      variant="secondary"
                      small
                      onClick={() =>
                        updateDay(d.day, cur => ({
                          ...cur,
                          intervals: [...cur.intervals, { open: '18:00', close: '23:00', overnight: false }],
                        }))
                      }
                    >
                      + Thêm khung giờ
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <ModalCancel />
        <Button onClick={handleSave}>Lưu giờ mở cửa</Button>
      </div>
    </Modal>
  );
}
