import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requestId } from './requestId.js';

const run = (header?: string | string[]) => {
  const setHeader = vi.fn();
  const req = {
    headers: header === undefined ? {} : { 'x-request-id': header },
  } as unknown as Request;
  const res = { setHeader } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  requestId(req, res, next);
  return { req, setHeader, next };
};

describe('requestId middleware (CONV-009)', () => {
  it('generates a UUID when the header is absent', () => {
    const { req, setHeader, next } = run();
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
    expect(next).toHaveBeenCalledOnce();
  });

  it('propagates a valid incoming id', () => {
    const { req, setHeader } = run('abc-123_XYZ');
    expect(req.id).toBe('abc-123_XYZ');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-123_XYZ');
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['illegal characters', 'abc def!!!!'],
    ['CRLF injection', 'abcdefgh\r\nSet-Cookie: x=1'],
    ['empty', ''],
    ['repeated header', ['abcdefgh', 'ijklmnop']],
  ])('replaces an invalid id: %s', (_name, value) => {
    const { req } = run(value);
    expect(req.id).not.toBe(value);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
