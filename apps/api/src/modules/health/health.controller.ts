import type { RequestHandler } from 'express';
import { sendSuccess } from '../../lib/response.js';

export const health: RequestHandler = (_req, res) => {
  sendSuccess(res, { status: 'ok' });
};
