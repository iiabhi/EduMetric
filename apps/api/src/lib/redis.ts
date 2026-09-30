import { Redis } from 'ioredis';
import type { Config } from '../config/env.js';
import type { Logger } from './logger.js';

export type RedisClient = Redis;

/**
 * `api`: commands fail at once while Redis is down (no offline queue, short timeout), so /readyz and
 * the rate limiter answer quickly. `bullmq`: BullMQ workers need unlimited retries per request.
 */
export type RedisRole = 'api' | 'bullmq';

const LOG_INTERVAL_MS = 30_000;
const COMMAND_TIMEOUT_MS = 1000;

/** Returns a function that logs a warning at most once per interval (CACHE-009: rate-limited Redis logs). */
export const createThrottledWarn = (logger: Logger, intervalMs = LOG_INTERVAL_MS) => {
  let last = 0;
  return (err: unknown, message: string): void => {
    const now = Date.now();
    if (now - last < intervalMs) return;
    last = now;
    logger.warn({ err }, message);
  };
};

/**
 * Create a Redis client (one per role per process; the caller owns `quit()`). It connects in the
 * background and reconnects by itself, so the process starts while Redis is down (DOCKER-009). The
 * URL may contain a password, so it is never logged.
 */
export const createRedisClient = (
  config: Pick<Config, 'redisUrl'>,
  logger: Logger,
  role: RedisRole,
): RedisClient => {
  const client = new Redis(
    config.redisUrl,
    role === 'api'
      ? { enableOfflineQueue: false, commandTimeout: COMMAND_TIMEOUT_MS, maxRetriesPerRequest: 1 }
      : { maxRetriesPerRequest: null },
  );
  const warn = createThrottledWarn(logger);
  client.on('error', (err: unknown) => {
    warn(err, 'Redis error');
  });
  return client;
};
