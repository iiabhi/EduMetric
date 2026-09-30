import { ERROR_HTTP_STATUS, type ErrorCode, type ValidationDetail } from '@edumetrics/shared';

const STATUS_BY_CODE = new Map<string, number>(Object.entries(ERROR_HTTP_STATUS));

interface AppErrorOptions {
  details?: ValidationDetail[];
  retryAfterSeconds?: number;
  cause?: unknown;
}

/** Expected, client-safe error. The message is returned to clients, so never put internals in it. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ValidationDetail[] | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = STATUS_BY_CODE.get(code) ?? 500;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export class ValidationError extends AppError {
  constructor(details: ValidationDetail[] = [], message = 'Invalid request') {
    super('VALIDATION_ERROR', message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message);
  }
}

/** Also used for records owned by another user (CONV-005). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('RESOURCE_NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super('CONFLICT', message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large') {
    super('PAYLOAD_TOO_LARGE', message);
  }
}

export class RateLimitedError extends AppError {
  constructor(retryAfterSeconds: number, message = 'Too many requests') {
    super('RATE_LIMITED', message, { retryAfterSeconds });
  }
}

type ProviderCode = Extract<
  ErrorCode,
  | 'CODING_PROVIDER_UNAVAILABLE'
  | 'CODING_PLATFORM_DISABLED'
  | 'NEWS_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_UNAVAILABLE'
>;

export class ProviderUnavailableError extends AppError {
  constructor(code: ProviderCode, message = 'Service temporarily unavailable') {
    super(code, message);
  }
}

/** A required dependency (database, cache) is unreachable. Used by /readyz. */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service not ready') {
    super('SERVICE_UNAVAILABLE', message);
  }
}
