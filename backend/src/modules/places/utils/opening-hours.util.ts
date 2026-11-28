import { ApiException, type FieldErrorDto } from '../../../common/api-error';
import { DayOfWeek } from '../place.enums';
import type { OpeningDayDoc } from '../schemas/place.schema';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS_ORDER: DayOfWeek[] = [
  DayOfWeek.SUN,
  DayOfWeek.MON,
  DayOfWeek.TUE,
  DayOfWeek.WED,
  DayOfWeek.THU,
  DayOfWeek.FRI,
  DayOfWeek.SAT,
];

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Validates opening hours according to G1 rules (no duplicate days, no overlapping intervals). */
export function validateOpeningHours(hours?: OpeningDayDoc[]): OpeningDayDoc[] {
  if (!hours || hours.length === 0) {
    return [];
  }
  const errors: FieldErrorDto[] = [];
  if (hours.length > 7) {
    errors.push({ field: 'hours', rule: 'maxItems', message: 'Tối đa 7 ngày trong tuần.' });
  }
  const seenDays = new Set<string>();
  const normalized: OpeningDayDoc[] = [];

  hours.forEach((dayEntry, dayIdx) => {
    if (seenDays.has(dayEntry.day)) {
      errors.push({
        field: `hours.${dayIdx}.day`,
        rule: 'unique',
        message: `Ngày ${dayEntry.day} bị trùng lặp.`,
      });
    }
    seenDays.add(dayEntry.day);

    if (dayEntry.closed) {
      normalized.push({ day: dayEntry.day, closed: true, intervals: [] });
      return;
    }

    const intervals = dayEntry.intervals ?? [];
    if (intervals.length > 3) {
      errors.push({
        field: `hours.${dayIdx}.intervals`,
        rule: 'maxItems',
        message: 'Mỗi ngày có tối đa 3 khung giờ.',
      });
    }

    const parsed: { start: number; end: number; idx: number }[] = [];
    intervals.forEach((interval, idx) => {
      if (!TIME_RE.test(interval.open)) {
        errors.push({
          field: `hours.${dayIdx}.intervals.${idx}.open`,
          rule: 'format',
          message: 'Giờ mở cửa phải theo định dạng HH:mm.',
        });
        return;
      }
      if (!TIME_RE.test(interval.close)) {
        errors.push({
          field: `hours.${dayIdx}.intervals.${idx}.close`,
          rule: 'format',
          message: 'Giờ đóng cửa phải theo định dạng HH:mm.',
        });
        return;
      }
      const openMin = toMinutes(interval.open);
      const closeMin = toMinutes(interval.close);
      if (interval.overnight) {
        if (closeMin >= openMin) {
          errors.push({
            field: `hours.${dayIdx}.intervals.${idx}.close`,
            rule: 'overnight',
            message: 'Khung giờ qua đêm phải có giờ đóng cửa nhỏ hơn giờ mở cửa.',
          });
          return;
        }
        parsed.push({ start: openMin, end: closeMin + 1440, idx });
      } else {
        if (openMin >= closeMin) {
          errors.push({
            field: `hours.${dayIdx}.intervals.${idx}.close`,
            rule: 'range',
            message: 'Giờ đóng cửa phải lớn hơn giờ mở cửa (hoặc bật qua đêm).',
          });
          return;
        }
        parsed.push({ start: openMin, end: closeMin, idx });
      }
    });

    parsed.sort((a, b) => a.start - b.start);
    for (let i = 1; i < parsed.length; i += 1) {
      if (parsed[i].start < parsed[i - 1].end) {
        errors.push({
          field: `hours.${dayIdx}.intervals.${parsed[i].idx}`,
          rule: 'overlap',
          message: 'Các khung giờ trong cùng một ngày không được chồng nhau.',
        });
      }
    }

    normalized.push({
      day: dayEntry.day,
      closed: false,
      intervals: intervals.map(i => ({
        open: i.open,
        close: i.close,
        ...(i.overnight ? { overnight: true } : {}),
      })),
    });
  });

  if (errors.length > 0) {
    throw new ApiException(422, 'VALIDATION_ERROR', 'Giờ mở cửa chưa hợp lệ.', errors);
  }
  return normalized;
}

/** Evaluates whether a place is currently open in Vietnam time (UTC+7), supporting overnight intervals. */
export function isOpenNowVn(hours: OpeningDayDoc[] | undefined, now: Date = new Date()): boolean {
  if (!hours || hours.length === 0) {
    return false;
  }
  const vnDate = new Date(now.getTime() + 7 * 3600_000);
  const dayIndex = vnDate.getUTCDay(); // 0 = SUN .. 6 = SAT
  const today = DAYS_ORDER[dayIndex];
  const yesterday = DAYS_ORDER[(dayIndex + 6) % 7];
  const currentMin = vnDate.getUTCHours() * 60 + vnDate.getUTCMinutes();

  const byDay = new Map(hours.map(h => [h.day, h]));
  const todayEntry = byDay.get(today);
  if (todayEntry && !todayEntry.closed) {
    for (const iv of todayEntry.intervals ?? []) {
      const openMin = toMinutes(iv.open);
      const closeMin = toMinutes(iv.close);
      if (iv.overnight) {
        if (currentMin >= openMin) return true;
      } else if (currentMin >= openMin && currentMin < closeMin) {
        return true;
      }
    }
  }

  const yesterdayEntry = byDay.get(yesterday);
  if (yesterdayEntry && !yesterdayEntry.closed) {
    for (const iv of yesterdayEntry.intervals ?? []) {
      if (iv.overnight) {
        const closeMin = toMinutes(iv.close);
        if (currentMin < closeMin) return true;
      }
    }
  }

  return false;
}

/** Earth surface distance in meters between two {lat, lng} points. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
