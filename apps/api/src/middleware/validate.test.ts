import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';
import { validate } from './validate.js';

const run = (
  schemas: Parameters<typeof validate>[0],
  input: { body?: unknown; query?: unknown; params?: unknown },
) => {
  const req = {
    body: input.body,
    query: input.query ?? {},
    params: input.params ?? {},
    validated: {},
  } as unknown as Request;
  const next = vi.fn();
  validate(schemas)(req, {} as Response, next);
  return { req, next };
};

describe('validate middleware', () => {
  const body = z.object({ name: z.string().max(5), age: z.coerce.number().int().optional() });

  it('passes valid input and stores parsed values', () => {
    const { req, next } = run({ body }, { body: { name: 'Ann', age: '7' } });
    expect(next).toHaveBeenCalledWith();
    expect(req.validated.body).toEqual({ name: 'Ann', age: 7 });
  });

  it('rejects unknown body fields even when the schema was not declared strict (CONV-007)', () => {
    const { next } = run({ body }, { body: { name: 'Ann', isAdmin: true } });
    const err = next.mock.calls[0]?.[0] as ValidationError;
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details?.[0]?.message).toContain('isAdmin');
  });

  it('rejects over-long strings and reports the field path', () => {
    const { next } = run({ body }, { body: { name: 'too long name' } });
    const err = next.mock.calls[0]?.[0] as ValidationError;
    expect(err.details).toEqual([{ path: 'name', message: expect.any(String) as string }]);
  });

  it('validates query and params and collects every failure', () => {
    const { next } = run(
      {
        query: z.object({ limit: z.coerce.number().int().min(1) }),
        params: z.object({ id: z.uuid() }),
      },
      { query: { limit: '0' }, params: { id: 'nope' } },
    );
    const err = next.mock.calls[0]?.[0] as ValidationError;
    expect(err.details?.map((d) => d.path).sort()).toEqual(['id', 'limit']);
  });

  it('keeps refine() rules on the schema (cross-field checks)', () => {
    const matching = z
      .object({ a: z.string(), b: z.string() })
      .refine((v) => v.a === v.b, { message: 'must match', path: ['b'] });
    const { next } = run({ body: matching }, { body: { a: 'x', b: 'y' } });
    const err = next.mock.calls[0]?.[0] as ValidationError;
    expect(err.details).toEqual([{ path: 'b', message: 'must match' }]);
  });

  it('rejects a missing body', () => {
    const { next } = run({ body }, { body: undefined });
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ValidationError);
  });

  it('truncates very long messages', () => {
    const { next } = run({ body }, { body: { ['k'.repeat(1000)]: 1, name: 'a' } });
    const err = next.mock.calls[0]?.[0] as ValidationError;
    for (const d of err.details ?? []) expect(d.message.length).toBeLessThanOrEqual(200);
  });
});
