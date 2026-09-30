import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from '@edumetrics/shared';
import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ProviderUnavailableError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
  isAppError,
} from './errors.js';

describe('AppError', () => {
  it('derives the HTTP status from the code catalog', () => {
    for (const [code, status] of Object.entries(ERROR_HTTP_STATUS)) {
      expect(new AppError(code as ErrorCode, 'm').status).toBe(status);
    }
    expect(Object.keys(ERROR_HTTP_STATUS)).toEqual(Object.values(ERROR_CODES));
  });

  it('keeps the cause and is an Error', () => {
    const cause = new Error('db down');
    const e = new AppError('INTERNAL_ERROR', 'm', { cause });
    expect(e).toBeInstanceOf(Error);
    expect(e.cause).toBe(cause);
  });
});

describe('error subclasses', () => {
  it('maps each subclass to its code and status', () => {
    expect(new ValidationError([{ path: 'a', message: 'b' }])).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: [{ path: 'a', message: 'b' }],
    });
    expect(new UnauthorizedError()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(new ForbiddenError()).toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(new NotFoundError()).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      message: 'Resource not found',
    });
    expect(new ConflictError()).toMatchObject({ code: 'CONFLICT', status: 409 });
    expect(new PayloadTooLargeError()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
    expect(new RateLimitedError(30)).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(new ProviderUnavailableError('NEWS_PROVIDER_UNAVAILABLE')).toMatchObject({
      code: 'NEWS_PROVIDER_UNAVAILABLE',
      status: 503,
    });
  });

  it('only exposes details on validation errors', () => {
    expect(new NotFoundError().details).toBeUndefined();
  });

  it('isAppError narrows correctly', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('x')).toBe(false);
  });
});
