import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorEnvelopeSchema, paginatedEnvelope, successEnvelope } from './envelope.js';

describe('successEnvelope', () => {
  const schema = successEnvelope(z.object({ id: z.string() }));

  it('accepts a success envelope', () => {
    expect(schema.safeParse({ success: true, data: { id: 'a' } }).success).toBe(true);
  });

  it('accepts optional meta', () => {
    expect(schema.safeParse({ success: true, data: { id: 'a' }, meta: { x: 1 } }).success).toBe(
      true,
    );
  });

  it('rejects success=false and bad data', () => {
    expect(schema.safeParse({ success: false, data: { id: 'a' } }).success).toBe(false);
    expect(schema.safeParse({ success: true, data: { id: 1 } }).success).toBe(false);
  });
});

describe('paginatedEnvelope', () => {
  const schema = paginatedEnvelope(z.object({ id: z.string() }));

  it('accepts a page with and without next cursor', () => {
    const ok = (nextCursor: string | null) =>
      schema.safeParse({
        success: true,
        data: [{ id: 'a' }],
        meta: { pagination: { nextCursor, limit: 20 } },
      }).success;
    expect(ok('abc')).toBe(true);
    expect(ok(null)).toBe(true);
  });

  it('requires pagination meta', () => {
    expect(schema.safeParse({ success: true, data: [], meta: {} }).success).toBe(false);
  });
});

describe('errorEnvelopeSchema', () => {
  it('accepts an error envelope with requestId', () => {
    const r = errorEnvelopeSchema.safeParse({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', requestId: 'req-12345' },
    });
    expect(r.success).toBe(true);
  });

  it('accepts validation details', () => {
    const r = errorEnvelopeSchema.safeParse({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: [{ path: 'email', message: 'Invalid' }],
        requestId: 'req-12345',
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown codes and a missing requestId', () => {
    expect(
      errorEnvelopeSchema.safeParse({
        success: false,
        error: { code: 'NOPE', message: 'x', requestId: 'r' },
      }).success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'x' },
      }).success,
    ).toBe(false);
  });
});
