import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Incoming IDs are only trusted if they are short and made of safe characters (no log/header injection). */
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.id =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
