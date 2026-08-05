import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

// offset-based today; cursor-based pagination will add a `cursor` field
// alongside (not instead of) limit, so callers keep working unchanged.
export interface OffsetPage {
  limit: number;
  offset: number;
}

export interface PageMeta {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function parseOffsetPage(query: {
  limit?: string;
  offset?: string;
}): OffsetPage {
  let limit = DEFAULT_PAGE_LIMIT;
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    if (limit > MAX_PAGE_LIMIT) {
      throw new BadRequestException(`limit must not exceed ${MAX_PAGE_LIMIT}`);
    }
  }

  let offset = 0;
  if (query.offset !== undefined) {
    offset = Number(query.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException('offset must be a non-negative integer');
    }
  }

  return { limit, offset };
}

export function paginate<T>(
  items: T[],
  total: number,
  page: OffsetPage,
): Paginated<T> {
  return {
    items,
    meta: {
      limit: page.limit,
      offset: page.offset,
      total,
      hasMore: page.offset + items.length < total,
    },
  };
}
