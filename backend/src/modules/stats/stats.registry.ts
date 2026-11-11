import { Injectable, Logger } from '@nestjs/common';

// Numbers for the admin dashboard that other teams own (places, suggestions, posts, documents,
// reports). TV1 only adds them up and draws them; it never queries their collections. Each team
// registers ONE contributor from its own module (see backend/README.md):
//
//   onModuleInit() { this.stats.register({ name: 'places', overview: ..., daily: ... }); }
//
// Anything a team does not provide stays absent from the response: the dashboard shows "—",
// never an invented zero.

/** KPI fields a contributor may supply. TV1 itself supplies totalUsers and newUsers. */
export const CONTRIBUTED_COUNTS = [
  'totalPlaces',
  'pendingSuggestions',
  'totalPosts',
  'totalDocuments',
  'pendingDocuments',
  'openReports',
] as const;
export type ContributedCount = (typeof CONTRIBUTED_COUNTS)[number];

/** Daily series a contributor may supply (the users series is TV1's). */
export const CONTRIBUTED_SERIES = ['places', 'posts', 'documents', 'reports'] as const;
export type ContributedSeries = (typeof CONTRIBUTED_SERIES)[number];

/** A half-open time window [from, to). */
export type StatsWindow = { from: Date; to: Date };

export type OverviewContribution = Partial<Record<ContributedCount, number>> & {
  placesByCategory?: Record<string, number>;
};
/** One count per calendar day, `date` as YYYY-MM-DD in Vietnam time (UTC+7). Missing days mean 0. */
export type DailyContribution = Partial<Record<ContributedSeries, { date: string; count: number }[]>>;

export interface StatsContributor {
  /** Short name of the source, used in "could not load" messages (e.g. 'places'). */
  name: string;
  /** Current totals/pending counts. `window` is the range the screen is looking at. */
  overview?(window: StatsWindow): Promise<OverviewContribution>;
  /** New items per day in `window`, for the series this contributor owns. */
  daily?(window: StatsWindow): Promise<DailyContribution>;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

@Injectable()
export class StatsRegistry {
  private readonly logger = new Logger('Stats');
  private readonly contributors: StatsContributor[] = [];

  register(contributor: StatsContributor) {
    this.contributors.push(contributor);
  }

  /** Merges every contributor's totals. A contributor that fails is skipped and named in `failed`. */
  async overview(window: StatsWindow) {
    const stats: OverviewContribution = {};
    const failed: string[] = [];
    const results = await Promise.allSettled(this.contributors.map(c => c.overview?.(window)));
    results.forEach((result, index) => {
      const name = this.contributors[index].name;
      if (result.status === 'rejected') {
        failed.push(name);
        this.logger.warn(`Stats source "${name}" failed: ${(result.reason as Error)?.message}`);
        return;
      }
      for (const key of CONTRIBUTED_COUNTS) {
        const value = result.value?.[key];
        if (isCount(value)) stats[key] = value; // anything that is not a count is ignored
      }
      const byCategory = result.value?.placesByCategory;
      if (byCategory && Object.values(byCategory).every(isCount)) stats.placesByCategory = byCategory;
    });
    return { stats, failed };
  }

  /** Merges the daily series. Only series that some contributor actually provides are returned. */
  async daily(window: StatsWindow) {
    const series = new Map<ContributedSeries, Map<string, number>>();
    const failed: string[] = [];
    const results = await Promise.allSettled(this.contributors.map(c => c.daily?.(window)));
    results.forEach((result, index) => {
      const name = this.contributors[index].name;
      if (result.status === 'rejected') {
        failed.push(name);
        this.logger.warn(`Stats source "${name}" failed: ${(result.reason as Error)?.message}`);
        return;
      }
      for (const key of CONTRIBUTED_SERIES) {
        const rows = result.value?.[key];
        if (!Array.isArray(rows)) continue;
        const days = series.get(key) ?? new Map<string, number>();
        for (const row of rows) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(row?.date) && isCount(row.count)) {
            days.set(row.date, (days.get(row.date) ?? 0) + row.count);
          }
        }
        series.set(key, days);
      }
    });
    return { series, failed };
  }
}
