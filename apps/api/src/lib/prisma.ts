import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { Config } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { parseDatabaseUrl } from './databaseUrl.js';

export { PrismaClient };

const POOL_SIZE = 10;

/**
 * Create the Prisma client (one per process; the caller owns `$disconnect()`). It connects lazily,
 * so the process can start while MySQL is down. Query logging stays off: it would log emails and
 * token hashes (SEC-014).
 */
export const createPrismaClient = (config: Pick<Config, 'databaseUrl' | 'isProduction'>) => {
  const connection = parseDatabaseUrl(config.databaseUrl);
  const adapter = new PrismaMariaDb({
    ...connection,
    connectionLimit: POOL_SIZE,
    timezone: 'Z', // timestamps are stored in UTC (TD-014)
    // MySQL 8 caching_sha2_password without TLS needs this. Development only; production TLS is F-23.
    allowPublicKeyRetrieval: !config.isProduction,
  });
  return new PrismaClient({ adapter, log: ['warn', 'error'] });
};

export type Db = ReturnType<typeof createPrismaClient>;
