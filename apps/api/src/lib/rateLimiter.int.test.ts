import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOutboundLimiter } from './rateLimiter.js';
import type { RedisClient } from './redis.js';
import {
  createReadyTestRedis,
  createTestRedis,
  deleteKeysWithPrefix,
  newTestPrefix,
} from '../test-utils/redis.js';

const INTERVAL_MS = 200;
const TOLERANCE_MS = 15; // timers can fire a few ms early

describe('outbound rate limiter (real Redis)', () => {
  const prefix = newTestPrefix();
  let cleanup: RedisClient;
  let connectionA: RedisClient;
  let connectionB: RedisClient;

  beforeAll(async () => {
    [cleanup, connectionA, connectionB] = await Promise.all([
      createReadyTestRedis(),
      createReadyTestRedis(),
      createReadyTestRedis(),
    ]);
  });

  afterAll(async () => {
    await deleteKeysWithPrefix(cleanup, prefix);
    await Promise.all([cleanup.quit(), connectionA.quit(), connectionB.quit()]);
  });

  it('keeps the minimum interval across two limiters sharing Redis (CACHE-011)', async () => {
    const a = createOutboundLimiter({
      redis: connectionA,
      name: 'shared',
      minIntervalMs: INTERVAL_MS,
      prefix,
    });
    const b = createOutboundLimiter({
      redis: connectionB,
      name: 'shared',
      minIntervalMs: INTERVAL_MS,
      prefix,
    });

    const times: number[] = [];
    const call = async (limiter: typeof a) => {
      expect(await limiter.acquire()).toBe(true);
      times.push(Date.now());
    };
    await Promise.all(Array.from({ length: 10 }, (_v, i) => call(i % 2 === 0 ? a : b)));

    times.sort((x, y) => x - y);
    const gaps = times.slice(1).map((t, i) => t - (times.at(i) ?? t));
    expect(gaps).toHaveLength(9);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(INTERVAL_MS - TOLERANCE_MS);
  });

  it('limits each name separately', async () => {
    const one = createOutboundLimiter({
      redis: connectionA,
      name: 'one',
      minIntervalMs: 5000,
      prefix,
    });
    const two = createOutboundLimiter({
      redis: connectionB,
      name: 'two',
      minIntervalMs: 5000,
      prefix,
    });
    const started = Date.now();
    await one.acquire();
    await two.acquire();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('a denied request-path call reserves nothing (CACHE-011)', async () => {
    const limiter = createOutboundLimiter({
      redis: connectionA,
      name: 'budget',
      minIntervalMs: 400,
      prefix,
    });
    expect(await limiter.acquire()).toBe(true); // takes the current slot; the next is 400 ms away
    expect(await limiter.acquire({ maxWaitMs: 10 })).toBe(false);
    expect(await limiter.acquire({ maxWaitMs: 10 })).toBe(false);

    const started = Date.now();
    expect(await limiter.acquire()).toBe(true); // background call gets the very next slot
    expect(Date.now() - started).toBeLessThan(400 + 150);
  });

  it('throws a typed error while Redis is down instead of hanging', async () => {
    const down = createTestRedis('api');
    down.disconnect();
    const limiter = createOutboundLimiter({
      redis: down,
      name: 'down',
      minIntervalMs: 100,
      prefix,
    });
    await expect(limiter.acquire()).rejects.toThrow('Outbound rate limiter is unavailable');
  });
});
