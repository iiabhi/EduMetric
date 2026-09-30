import { pino, type DestinationStream, type Logger } from 'pino';
import type { Config } from '../config/env.js';

const SECRET_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
] as const;

/** Central redaction list (SEC-014). Secret fields are covered at the top level and up to 2 levels deep. */
export const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  ...SECRET_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

export const createLogger = (config: Config, destination?: DestinationStream): Logger =>
  pino(
    {
      level: config.logLevel,
      base: { service: 'edumetrics-api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    },
    destination,
  );

export type { Logger };
