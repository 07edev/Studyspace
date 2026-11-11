import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { AccountStatus, Role } from '../../common/enums';
import { toPage } from '../../common/utils/page';
import { User } from '../identity/schemas/user.schema';
import {
  ACTIVITY_MODULES,
  OVERVIEW_METRICS,
  type ActivityQuery,
  type DashboardQuery,
  type OverviewQuery,
} from './stats.dto';
import { CONTRIBUTED_SERIES, StatsRegistry, type StatsWindow } from './stats.registry';

// Days are calendar days in Vietnam time (UTC+7, no daylight saving), because that is the clock the
// admins read. `from`/`to` in requests are inclusive days; windows inside are half-open [from, to).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

const badQuery = (field: string, message: string) =>
  new ApiException(422, 'QUERY_INVALID', 'Tham số truy vấn không hợp lệ.', [{ field, rule: 'invalid', message }]);

const today = () => new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const dayStart = (day: string) => new Date(`${day}T00:00:00+07:00`);
const isRealDay = (day: string) => {
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
};

type Granularity = 'DAY' | 'WEEK' | 'MONTH';
// First day of the bucket a day belongs to: the day itself, its Monday, or the 1st of its month.
function bucketOf(day: string, granularity: Granularity): string {
  if (granularity === 'DAY') return day;
  if (granularity === 'MONTH') return `${day.slice(0, 7)}-01`;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly registry: StatsRegistry,
  ) {}

  /** Resolves inclusive from/to days (defaults: the last `defaultDays` days up to today). */
  private resolveRange(from: string | undefined, to: string | undefined, defaultDays: number) {
    const last = to ?? today();
    const first = from ?? addDays(last, -(defaultDays - 1));
    for (const [field, day] of [['from', first], ['to', last]] as const) {
      if (!isRealDay(day)) throw badQuery(field, 'Ngày không tồn tại.');
    }
    if (first > last) throw badQuery('from', 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    const days = (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS + 1;
    if (days > MAX_DAYS) throw badQuery('from', `Khoảng thời gian tối đa ${MAX_DAYS} ngày.`);
    const window: StatsWindow = { from: dayStart(first), to: dayStart(addDays(last, 1)) };
    return { first, last, window };
  }

  // "Users" = accounts with role USER that are not deleted (admins are staff, not users).
  private countUsers(window?: StatsWindow) {
    return this.users.countDocuments({
      role: Role.USER,
      status: { $ne: AccountStatus.DELETED },
      ...(window ? { createdAt: { $gte: window.from, $lt: window.to } } : {}),
    });
  }

  private async build(first: string, last: string, window: StatsWindow) {
    const [totalUsers, newUsers, contributed] = await Promise.all([
      this.countUsers(),
      this.countUsers(window),
      this.registry.overview(window),
    ]);
    return {
      stats: { totalUsers, newUsers, ...contributed.stats },
      range: { from: first, to: last },
      // Sources that were asked but did not answer: their numbers are missing, not zero.
      ...(contributed.failed.length > 0 ? { failedSources: contributed.failed } : {}),
    };
  }

  async dashboard(query: DashboardQuery) {
    const { first, last, window } = this.resolveRange(undefined, undefined, query.days ?? 7);
    const { stats, ...rest } = await this.build(first, last, window);
    return { ...stats, ...rest };
  }

  async overview(query: OverviewQuery) {
    const { first, last, window } = this.resolveRange(query.from, query.to, 7);
    const { stats, ...rest } = await this.build(first, last, window);
    if (query.metrics === undefined) return { ...stats, ...rest };
    const wanted = query.metrics.split(',').map(m => m.trim()).filter(Boolean);
    const unknown = wanted.filter(m => !(OVERVIEW_METRICS as readonly string[]).includes(m));
    if (wanted.length === 0 || unknown.length > 0) {
      throw badQuery('metrics', unknown.length ? `Không có chỉ số: ${unknown.join(', ')}.` : 'Cần ít nhất một chỉ số.');
    }
    return {
      ...Object.fromEntries(Object.entries(stats).filter(([key]) => wanted.includes(key))),
      ...rest,
    };
  }

  async activity(query: ActivityQuery) {
    const granularity: Granularity = query.granularity ?? 'DAY';
    const { first, last, window } = this.resolveRange(query.from, query.to, 30);
    const wanted = query.module ? [query.module] : [...ACTIVITY_MODULES];

    const perDay = new Map<string, Record<string, number>>(); // series -> day -> count
    const have: string[] = [];
    if (wanted.includes('users')) {
      have.push('users');
      const rows = await this.users.aggregate<{ _id: string; count: number }>([
        { $match: { role: Role.USER, status: { $ne: AccountStatus.DELETED }, createdAt: { $gte: window.from, $lt: window.to } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+07:00' } }, count: { $sum: 1 } } },
      ]);
      perDay.set('users', Object.fromEntries(rows.map(r => [r._id, r.count])));
    }
    const contributed = await this.registry.daily(window);
    for (const key of CONTRIBUTED_SERIES) {
      if (wanted.includes(key) && contributed.series.has(key)) {
        have.push(key);
        perDay.set(key, Object.fromEntries(contributed.series.get(key)!));
      }
    }

    // Every day in range gets a point (0 where nothing happened) so the line is not gappy.
    const buckets = new Map<string, Record<string, number>>();
    for (let day = first; day <= last; day = addDays(day, 1)) {
      const key = bucketOf(day, granularity);
      const point = buckets.get(key) ?? Object.fromEntries(have.map(series => [series, 0]));
      for (const series of have) point[series] += perDay.get(series)?.[day] ?? 0;
      buckets.set(key, point);
    }
    const items = [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, counts]) => ({ date, ...counts }));
    const page = toPage(items, items.length, 1, Math.max(1, items.length));
    return {
      ...page,
      granularity,
      range: { from: first, to: last },
      // Series that have data. A series nobody provides yet is simply not here.
      series: have,
      ...(contributed.failed.length > 0 ? { failedSources: contributed.failed } : {}),
    };
  }
}
