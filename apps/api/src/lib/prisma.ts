import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { Config } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { parseDatabaseUrl } from './databaseUrl.js';

export { PrismaClient };

/**
 * MySQL 8 `caching_sha2_password` over an unencrypted link needs public-key retrieval, which a
 * man-in-the-middle can abuse. Allowed in development and test only; F-23 requires TLS in production.
 */
export const allowsPublicKeyRetrieval = (env: string): boolean =>
  env === 'development' || env === 'test';

/**
 * Create the Prisma client (one per process; the caller owns `$disconnect()`). It connects lazily,
 * so the process can start while MySQL is down. Query logging stays off: it would log emails and
 * token hashes (SEC-014).
 */
export const createPrismaClient = (
  config: Pick<Config, 'env' | 'databaseUrl' | 'dbPoolSize' | 'dbAcquireTimeoutMs'>,
) => {
  const connection = parseDatabaseUrl(config.databaseUrl);
  const adapter = new PrismaMariaDb({
    ...connection,
    connectionLimit: config.dbPoolSize,
    // How long a query waits for a free connection before failing. Short by default (3 s, below the
    // adapter's 10 s), so a database outage does not leave requests hanging.
    acquireTimeout: config.dbAcquireTimeoutMs,
    timezone: 'Z', // timestamps are stored in UTC (TD-014)
    allowPublicKeyRetrieval: allowsPublicKeyRetrieval(config.env),
  });
  return new PrismaClient({
    adapter,
    log: ['warn', 'error'],
    // The default format echoes source lines around the failing call; keep that for development only.
    ...(config.env === 'development' ? {} : { errorFormat: 'minimal' as const }),
  });
};

export type Db = ReturnType<typeof createPrismaClient>;
