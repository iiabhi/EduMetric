import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, type PaginationMeta } from '@edumetrics/shared';
import type { z } from 'zod';
import { ValidationError } from './errors.js';

export type CursorPayload = Record<string, string | number | null>;

export const encodeCursor = (payload: CursorPayload): string =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

const invalidCursor = () => new ValidationError([{ path: 'cursor', message: 'Invalid cursor' }]);

/** Decode and validate an opaque cursor. Any failure is a generic VALIDATION_ERROR. */
export const decodeCursor = <T>(cursor: string, schema: z.ZodType<T>): T => {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw invalidCursor();
  return parsed.data;
};

/** Validate a page size for callers that do not go through paginationQuerySchema. */
export const resolveLimit = (limit: number | undefined): number => {
  if (limit === undefined) return DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new ValidationError([
      {
        path: 'limit',
        message: `limit must be an integer between 1 and ${String(MAX_PAGE_LIMIT)}`,
      },
    ]);
  }
  return limit;
};

/**
 * Turn rows fetched with `limit + 1` into a page. The extra row only signals that more exist;
 * nextCursor is built from the last row that is returned.
 */
export const buildPage = <T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => CursorPayload,
): { items: T[]; pagination: PaginationMeta } => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    pagination: {
      nextCursor: hasMore && last !== undefined ? encodeCursor(cursorOf(last)) : null,
      limit,
    },
  };
};
