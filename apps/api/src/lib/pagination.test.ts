import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from './errors.js';
import { buildPage, decodeCursor, encodeCursor, resolveLimit } from './pagination.js';

const cursorSchema = z.object({ t: z.string(), id: z.string() }).strict();

describe('cursor encoding', () => {
  it('round-trips and is base64url (CONV-006)', () => {
    const cursor = encodeCursor({ t: '2026-01-01T00:00:00.000Z', id: 'abc' });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, cursorSchema)).toEqual({
      t: '2026-01-01T00:00:00.000Z',
      id: 'abc',
    });
  });

  it.each([
    ['not base64 json', '!!!'],
    ['base64 of non-json', Buffer.from('hello').toString('base64url')],
    ['wrong shape', Buffer.from(JSON.stringify({ x: 1 })).toString('base64url')],
    ['extra keys', Buffer.from(JSON.stringify({ t: 'a', id: 'b', z: 1 })).toString('base64url')],
    ['json array', Buffer.from('[1,2]').toString('base64url')],
  ])('rejects a tampered cursor: %s', (_name, cursor) => {
    expect(() => decodeCursor(cursor, cursorSchema)).toThrow(ValidationError);
  });

  it('reports the cursor path without echoing the input', () => {
    try {
      decodeCursor('bad-cursor-value', cursorSchema);
      expect.unreachable();
    } catch (e) {
      const err = e as ValidationError;
      expect(err.details).toEqual([{ path: 'cursor', message: 'Invalid cursor' }]);
      expect(err.message).not.toContain('bad-cursor-value');
    }
  });
});

describe('resolveLimit', () => {
  it('defaults to 20', () => {
    expect(resolveLimit(undefined)).toBe(20);
  });
  it('accepts 1..100', () => {
    expect(resolveLimit(1)).toBe(1);
    expect(resolveLimit(100)).toBe(100);
  });
  it.each([0, -1, 101, 1.5, Number.NaN])('rejects %s', (n) => {
    expect(() => resolveLimit(n)).toThrow(ValidationError);
  });
});

describe('buildPage', () => {
  const rows = [1, 2, 3, 4, 5].map((n) => ({ id: `id${n}`, t: `t${n}` }));
  const cursorOf = (r: { id: string; t: string }) => ({ t: r.t, id: r.id });

  it('trims the extra row and sets nextCursor from the last kept row', () => {
    const page = buildPage(rows.slice(0, 3), 2, cursorOf);
    expect(page.items).toHaveLength(2);
    expect(page.pagination.limit).toBe(2);
    expect(decodeCursor(page.pagination.nextCursor ?? '', cursorSchema)).toEqual({
      t: 't2',
      id: 'id2',
    });
  });

  it('returns null cursor on an exact fit', () => {
    expect(buildPage(rows.slice(0, 2), 2, cursorOf).pagination.nextCursor).toBeNull();
  });

  it('returns null cursor on fewer rows and on empty', () => {
    expect(buildPage(rows.slice(0, 1), 2, cursorOf).pagination.nextCursor).toBeNull();
    const empty = buildPage([], 20, cursorOf);
    expect(empty.items).toEqual([]);
    expect(empty.pagination).toEqual({ nextCursor: null, limit: 20 });
  });
});
