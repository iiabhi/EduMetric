import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, paginationQuerySchema } from './pagination.js';

describe('paginationQuerySchema (CONV-006)', () => {
  it('defaults limit to 20', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: DEFAULT_PAGE_LIMIT });
    expect(DEFAULT_PAGE_LIMIT).toBe(20);
  });

  it('coerces numeric strings and accepts the max', () => {
    expect(paginationQuerySchema.parse({ limit: '100' }).limit).toBe(MAX_PAGE_LIMIT);
  });

  it.each(['0', '101', '-1', '1.5', 'abc', ''])('rejects limit=%s', (limit) => {
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('accepts a base64url cursor and rejects junk', () => {
    expect(paginationQuerySchema.safeParse({ cursor: 'eyJpZCI6MX0' }).success).toBe(true);
    expect(paginationQuerySchema.safeParse({ cursor: 'not base64!' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ cursor: 'a'.repeat(513) }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
  });

  it('rejects unknown query keys (CONV-007)', () => {
    expect(paginationQuerySchema.safeParse({ page: '2' }).success).toBe(false);
  });
});
