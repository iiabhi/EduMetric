import type { Request, RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../lib/logger.js';

/** Route template (e.g. /items/:id), never the raw URL, so IDs and query strings stay out of logs. */
const routeTemplate = (req: Request): string =>
  typeof req.route === 'object' && req.route !== null
    ? `${req.baseUrl}${String((req.route as { path?: unknown }).path)}`
    : 'unmatched';

/** One structured line per request: method, route, status, duration, request id (SRD 21). */
export const httpLogger = (logger: Logger): RequestHandler =>
  pinoHttp({
    logger,
    genReqId: (req) => (req as Request).id,
    serializers: {
      req: (req: { method: string }) => ({ method: req.method }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customProps: (req) => ({
      requestId: (req as Request).id,
      route: routeTemplate(req as Request),
    }),
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
  });
