import { createApp } from './app.js';
import { loadConfigOrExit } from './config/index.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';
import { createRedisClient } from './lib/redis.js';
import { buildReadinessChecks } from './modules/health/health.checks.js';
import { createHealthRepository } from './modules/health/health.repository.js';

const SHUTDOWN_TIMEOUT_MS = 15_000; // REL-009

const config = loadConfigOrExit();
const logger = createLogger(config);
// Both connect in the background, so the API starts even while MySQL or Redis is down.
// Feature modules receive them in later features.
const prisma = createPrismaClient(config);
const redis = createRedisClient(config, logger, 'api');
const app = createApp({
  config,
  logger,
  readinessChecks: buildReadinessChecks({ health: createHealthRepository(prisma), redis }),
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'API listening');
});

server.on('error', (err) => {
  logger.fatal({ err }, 'HTTP server error');
  process.exit(1);
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down');
  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();
  server.close(() => {
    void Promise.allSettled([prisma.$disconnect(), redis.quit()]).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error({ err: result.reason }, 'Closing a connection failed');
        }
      }
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
