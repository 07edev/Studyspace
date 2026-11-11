import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Shape of every paged list (Page<T> in the spec).
export type Page<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
};

export const toPage = <T>(items: T[], total: number, page: number, limit: number): Page<T> => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, pagination: { page, limit, total, totalPages, hasNext: page < totalPages } };
};

// `page` and `limit` query parameters, shared by every list endpoint. limit defaults to 20, max 100.
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export const pageParams = (query: PageQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit };
};

// User-typed search text must never act as a regular expression.
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
