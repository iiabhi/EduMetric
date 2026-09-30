import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import type { Config } from '../config/env.js';

const HSTS_MAX_AGE_SECONDS = 15_552_000;

/** Security headers (SEC-017, SEC-013). The API serves JSON only, so the CSP denies everything. */
export const securityHeaders = (config: Config): RequestHandler =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    strictTransportSecurity: config.isProduction
      ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true }
      : false,
  });

/** CORS with an explicit allow-list (SEC-012). Unlisted origins get no CORS headers. */
export const corsPolicy = (config: Config): RequestHandler => {
  const allowed = new Set(config.corsOrigins);
  return cors({
    origin: (requestOrigin, callback) => {
      callback(null, requestOrigin !== undefined && allowed.has(requestOrigin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
};
