import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Ngày cần có dạng YYYY-MM-DD.';

export const OVERVIEW_METRICS = [
  'totalUsers',
  'newUsers',
  'totalPlaces',
  'placesByCategory',
  'pendingSuggestions',
  'totalPosts',
  'totalDocuments',
  'pendingDocuments',
  'openReports',
] as const;
export const ACTIVITY_MODULES = ['users', 'places', 'posts', 'documents', 'reports'] as const;

// GET /admin/dashboard
export class DashboardQuery {
  // "New users" counts the last N days (default 7).
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90)
  days?: number;
}

// GET /admin/statistics/overview — from/to are calendar days (Vietnam time), both inclusive.
export class OverviewQuery {
  @IsOptional() @Matches(DATE, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional() @Matches(DATE, { message: DATE_MESSAGE })
  to?: string;

  // Comma separated subset of OVERVIEW_METRICS; validated in the service (QUERY_INVALID).
  @IsOptional() @IsString()
  metrics?: string;
}

// GET /admin/statistics/activity
export class ActivityQuery {
  @IsOptional() @Matches(DATE, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional() @Matches(DATE, { message: DATE_MESSAGE })
  to?: string;

  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value)) @IsIn(['DAY', 'WEEK', 'MONTH'])
  granularity?: 'DAY' | 'WEEK' | 'MONTH';

  // One series only; omit for all.
  @IsOptional() @IsIn(ACTIVITY_MODULES)
  module?: (typeof ACTIVITY_MODULES)[number];
}
