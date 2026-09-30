import { randomUUID } from 'node:crypto';
import { createLogger } from '../lib/logger.js';
import { createRedisClient, type RedisClient, type RedisRole } from '../lib/redis.js';
import { testConfig } from './config.js';

const COMPOSE_TEST_REDIS_URL = 'redis://127.0.0.1:6380';

/** Redis used by integration tests: REDIS_URL when set (CI), otherwise the compose test profile. */
export const testRedisUrl = (env: Record<string, string | undefined> = process.env): string =>
  env.REDIS_URL ?? COMPOSE_TEST_REDIS_URL;

export const createTestRedis = (role: RedisRole = 'bullmq'): RedisClient =>
  createRedisClient(
    { redisUrl: testRedisUrl() },
    createLogger(testConfig({ LOG_LEVEL: 'silent' })),
    role,
  );

/** A client that is already connected. The `api` role has no offline queue, so commands sent earlier fail. */
export const createReadyTestRedis = async (role: RedisRole = 'api'): Promise<RedisClient> => {
  const redis = createTestRedis(role);
  await waitFor(() => redis.status === 'ready');
  return redis;
};

/**
 * Every integration run uses its own key prefix and deletes only keys under it, so tests never need
 * FLUSHALL and cannot damage a development Redis even if REDIS_URL points at one.
 */
export const newTestPrefix = (): string => `test-${randomUUID()}`;

export const deleteKeysWithPrefix = async (redis: RedisClient, prefix: string): Promise<void> => {
  const keys: string[] = [];
  for await (const batch of redis.scanStream({ match: `${prefix}:*`, count: 200 })) {
    keys.push(...(batch as string[]));
  }
  if (keys.length > 0) await redis.del(...keys);
};

export const waitFor = async (
  check: () => Promise<boolean> | boolean,
  timeoutMs = 10_000,
  intervalMs = 25,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Condition not met within ${String(timeoutMs)} ms`);
};
