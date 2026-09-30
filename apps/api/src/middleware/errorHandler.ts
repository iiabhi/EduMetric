import type { ErrorEnvelope } from '@edumetrics/shared';
import type { ErrorRequestHandler } from 'express';
import type { AppError } from '../lib/errors.js';
import { PayloadTooLargeError, ValidationError, isAppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

const INTERNAL_MESSAGE = 'Internal server error';

interface BodyParserError {
  type: string;
  status: number;
}

const isBodyParserError = (error: unknown): error is BodyParserError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as { type?: unknown }).type === 'string' &&
  typeof (error as { status?: unknown }).status === 'number';

/** Translate body-parser failures into client-safe errors with fixed messages. */
const fromBodyParser = (error: BodyParserError): AppError | undefined => {
  if (error.type === 'entity.too.large') return new PayloadTooLargeError();
  if (error.status >= 400 && error.status < 500) {
    return new ValidationError([], 'Malformed request body');
  }
  return undefined;
};

const toAppError = (error: unknown): AppError | undefined => {
  if (isAppError(error)) return error;
  if (isBodyParserError(error)) return fromBodyParser(error);
  return undefined;
};

/**
 * Central error handler (CONV-003, API-004). Clients get a code, a fixed message and the request ID.
 * Stacks and causes go to the server log only.
 */
export const createErrorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = typeof req.id === 'string' ? req.id : 'unknown';
    const appError = toAppError(error);

    if (appError === undefined || appError.status >= 500) {
      const err =
        error instanceof Error ? error : new Error('Non-error value thrown', { cause: error });
      logger.error({ err, requestId }, 'Unhandled error');
    }

    if (appError === undefined) {
      const body: ErrorEnvelope = {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE, requestId },
      };
      res.status(500).json(body);
      return;
    }

    if (appError.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(appError.retryAfterSeconds));
    }

    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: appError.code,
        message: appError.code === 'INTERNAL_ERROR' ? INTERNAL_MESSAGE : appError.message,
        ...(appError.code === 'VALIDATION_ERROR' && appError.details !== undefined
          ? { details: appError.details }
          : {}),
        requestId,
      },
    };
    res.status(appError.status).json(body);
  };
