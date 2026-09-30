import type { RequestHandler } from 'express';
import { ServiceUnavailableError } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { sendSuccess } from '../../lib/response.js';
import type { ReadinessService } from './health.service.js';

export const health: RequestHandler = (_req, res) => {
  sendSuccess(res, { status: 'ok' });
};

/** Failed dependency names go to the log only; the client gets a fixed 503 (ADR 0005). */
export const createReadyz =
  (service: ReadinessService, logger: Logger): RequestHandler =>
  async (req, res) => {
    const result = await service.run();
    if (!result.ready) {
      logger.warn({ requestId: req.id, failed: result.failed }, 'Readiness check failed');
      throw new ServiceUnavailableError();
    }
    sendSuccess(res, { status: 'ready' });
  };
