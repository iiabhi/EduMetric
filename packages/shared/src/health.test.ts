import { describe, expect, it } from 'vitest';
import { healthResponseSchema, readyResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts the healthz payload', () => {
    expect(healthResponseSchema.safeParse({ success: true, data: { status: 'ok' } }).success).toBe(
      true,
    );
  });

  it('rejects other statuses', () => {
    expect(
      healthResponseSchema.safeParse({ success: true, data: { status: 'down' } }).success,
    ).toBe(false);
  });
});

describe('readyResponseSchema', () => {
  it('accepts the readyz payload', () => {
    expect(
      readyResponseSchema.safeParse({ success: true, data: { status: 'ready' } }).success,
    ).toBe(true);
  });

  it('rejects the healthz status', () => {
    expect(readyResponseSchema.safeParse({ success: true, data: { status: 'ok' } }).success).toBe(
      false,
    );
  });
});
