import { loadConfigOrExit } from './config/index.js';
import { handlers } from './jobs/processors/index.js';
import { startWorkers } from './jobs/worker.js';
import { createLogger } from './lib/logger.js';
import { createRedisClient } from './lib/redis.js';

const SHUTDOWN_TIMEOUT_MS = 30_000; // JOB-014

const config = loadConfigOrExit();
const logger = createLogger(config, undefined, 'edumetrics-worker');
const redis = createRedisClient(config, logger, 'bullmq');
const workers = startWorkers({
  redis,
  logger,
  handlers,
  concurrency: config.queueConcurrency,
});

workers
  .ready()
  .then(() => {
    logger.info({ queues: workers.queues, env: config.env }, 'Worker ready');
  })
  .catch((err: unknown) => {
    logger.fatal({ err }, 'Worker failed to start');
    process.exit(1);
  });

let stopping = false;
const shutdown = (signal: string) => {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Shutting down: finishing in-flight jobs');
  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();
  workers
    .close()
    .then(() => redis.quit())
    .then(() => {
      logger.info('Worker stopped');
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Shutdown failed');
      process.exit(1);
    });
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
// REL-001: log and exit only on truly unrecoverable errors; the orchestrator restarts the worker.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
