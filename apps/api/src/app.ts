import express, { type Express } from 'express';
import type { Config } from './config/env.js';
import type { Logger } from './lib/logger.js';
import { buildOpenApiDocument } from './lib/openapi.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { corsPolicy, securityHeaders } from './middleware/security.js';
import type { ReadinessCheck } from './modules/health/health.service.js';
import { createHealthRouter } from './modules/health/health.routes.js';

export const JSON_BODY_LIMIT = '100kb';

export interface AppDeps {
  config: Config;
  logger: Logger;
  /** Dependencies probed by GET /readyz. Empty means always ready. */
  readinessChecks?: ReadinessCheck[];
  /** Mount extra routers after the body parser and before the 404 handler. Used by feature modules and tests. */
  mountRoutes?: (app: Express) => void;
}

/** Express app factory. Does not listen, so it can be tested with Supertest. */
export const createApp = ({
  config,
  logger,
  readinessChecks = [],
  mountRoutes,
}: AppDeps): Express => {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use((req, _res, next) => {
    req.validated = {};
    next();
  });
  app.use(httpLogger(logger));
  app.use(securityHeaders(config));
  app.use(corsPolicy(config));
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));

  app.use(createHealthRouter({ checks: readinessChecks, logger }));

  if (!config.isProduction) {
    app.get('/api/docs', (_req, res) => {
      res.json(buildOpenApiDocument());
    });
  }

  mountRoutes?.(app);

  app.use(notFound);
  app.use(createErrorHandler(logger));
  return app;
};
