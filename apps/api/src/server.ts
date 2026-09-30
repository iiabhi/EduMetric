import { createApp } from './app.js';
import { loadConfigOrExit } from './config/index.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';
import { buildReadinessChecks } from './modules/health/health.checks.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfigOrExit();
const logger = createLogger(config);
// Connects lazily, so the API starts even while MySQL is down. Feature modules receive it in later features.
const prisma = createPrismaClient(config);
const app = createApp({ config, logger, readinessChecks: buildReadinessChecks(config) });

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
    prisma
      .$disconnect()
      .catch((err: unknown) => {
        logger.error({ err }, 'Prisma disconnect failed');
      })
      .finally(() => {
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
