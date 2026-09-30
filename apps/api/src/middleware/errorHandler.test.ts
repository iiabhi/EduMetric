import { ERROR_HTTP_STATUS, type ErrorCode } from '@edumetrics/shared';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  AppError,
  NotFoundError,
  ProviderUnavailableError,
  RateLimitedError,
  ValidationError,
} from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { testConfig } from '../test-utils/config.js';
import { LogCapture } from '../test-utils/log-capture.js';
import { createErrorHandler } from './errorHandler.js';

const setup = () => {
  const out = new LogCapture();
  const handler = createErrorHandler(createLogger(testConfig({ LOG_LEVEL: 'info' }), out));
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn();
  const res = { status, json, setHeader, headersSent: false } as unknown as Response & {
    headersSent: boolean;
  };
  status.mockReturnValue(res);
  const next = vi.fn();
  const req = { id: 'req-12345678' } as unknown as Request;
  const run = (error: unknown) => {
    handler(error, req, res, next);
  };
  return { out, run, json, setHeader, status, next, res };
};

describe('central error handler', () => {
  it.each(Object.entries(ERROR_HTTP_STATUS))('maps AppError %s to HTTP %i', (code, httpStatus) => {
    const { run, status, json } = setup();
    run(new AppError(code as ErrorCode, 'client message'));
    expect(status).toHaveBeenCalledWith(httpStatus);
    const body = json.mock.calls[0]?.[0] as {
      success: boolean;
      error: { code: string; requestId: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(code);
    expect(body.error.requestId).toBe('req-12345678');
  });

  it('includes details only for VALIDATION_ERROR', () => {
    const a = setup();
    a.run(new ValidationError([{ path: 'email', message: 'Invalid' }]));
    expect(a.json.mock.calls[0]?.[0]).toMatchObject({
      error: { details: [{ path: 'email', message: 'Invalid' }] },
    });

    const b = setup();
    b.run(new NotFoundError());
    expect((b.json.mock.calls[0]?.[0] as { error: object }).error).not.toHaveProperty('details');
  });

  it('sets Retry-After for RATE_LIMITED', () => {
    const { run, setHeader } = setup();
    run(new RateLimitedError(42));
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('keeps the provider-unavailable message but hides unknown error internals', () => {
    const a = setup();
    a.run(new ProviderUnavailableError('NEWS_PROVIDER_UNAVAILABLE'));
    expect(a.status).toHaveBeenCalledWith(503);
    expect(a.json.mock.calls[0]?.[0]).toMatchObject({
      error: { message: 'Service temporarily unavailable' },
    });

    const b = setup();
    b.run(new Error('SELECT * FROM users failed: password=hunter2'));
    expect(b.status).toHaveBeenCalledWith(500);
    const serialised = JSON.stringify(b.json.mock.calls[0]?.[0]);
    expect(serialised).toContain('INTERNAL_ERROR');
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('SELECT');
    expect(serialised).not.toContain('stack');
  });

  it('logs the stack and request id for unexpected errors only', () => {
    const { out, run } = setup();
    run(new Error('boom'));
    const line = out.lines[0] as { requestId: string; err: { stack: string } };
    expect(line.requestId).toBe('req-12345678');
    expect(line.err.stack).toContain('Error: boom');

    const quiet = setup();
    quiet.run(new NotFoundError());
    expect(quiet.out.raw).toBe('');
  });

  it('handles non-Error throws as INTERNAL_ERROR', () => {
    const { out, run, status } = setup();
    run('a string was thrown');
    expect(status).toHaveBeenCalledWith(500);
    expect(out.raw).toContain('Non-error value thrown');
  });

  it('maps body-parser errors to fixed, client-safe errors', () => {
    const tooLarge = setup();
    tooLarge.run(
      Object.assign(new Error('request entity too large'), {
        type: 'entity.too.large',
        status: 413,
      }),
    );
    expect(tooLarge.status).toHaveBeenCalledWith(413);
    expect(tooLarge.json.mock.calls[0]?.[0]).toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });

    const bad = setup();
    bad.run(
      Object.assign(new SyntaxError('Unexpected token } in JSON at position 7'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
    );
    expect(bad.status).toHaveBeenCalledWith(400);
    const body = JSON.stringify(bad.json.mock.calls[0]?.[0]);
    expect(body).toContain('VALIDATION_ERROR');
    expect(body).not.toContain('Unexpected token');
  });

  it('delegates to Express when headers were already sent', () => {
    const { run, res, next, json } = setup();
    res.headersSent = true;
    const error = new Error('late');
    run(error);
    expect(next).toHaveBeenCalledWith(error);
    expect(json).not.toHaveBeenCalled();
  });

  it('falls back to an unknown request id', () => {
    const { json, res, next } = setup();
    const handler = createErrorHandler(createLogger(testConfig(), new LogCapture()));
    handler(new NotFoundError(), {} as Request, res, next);
    expect(json.mock.calls[0]?.[0]).toMatchObject({ error: { requestId: 'unknown' } });
  });
});
