import type { RequestHandler } from 'express';
import { NotFoundError } from '../lib/errors.js';

/** Unknown routes use the standard envelope via the central error handler (CONV-003). */
export const notFound: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};
