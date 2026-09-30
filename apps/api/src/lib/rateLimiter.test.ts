import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOutboundLimiter, RateLimiterUnavailableError } from './rateLimiter.js';
import type { RedisClient } from './redis.js';

// A stand-in client: defineCommand records the script, and the command it defines answers as told.
const fakeRedis = (answer: () => Promise<number>) => {
  const calls: unknown[][] = [];
  const redis = {
    defineCommand: vi.fn(),
    acquireOutboundSlot: (...args: unknown[]) => {
      calls.push(args);
      return answer();
    },
  };
  return { redis: redis as unknown as RedisClient, calls, defineCommand: redis.defineCommand };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createOutboundLimiter', () => {
  it('registers one Lua command with one key', () => {
    const { redis, defineCommand } = fakeRedis(() => Promise.resolve(0));
    createOutboundLimiter({ redis, name: 'codeforces', minIntervalMs: 2100 });
    expect(defineCommand).toHaveBeenCalledWith(
      'acquireOutboundSlot',
      expect.objectContaining({ numberOfKeys: 1, lua: expect.stringContaining('TIME') as string }),
    );
  });

  it('passes a namespaced key, the interval and "no limit" for background callers', async () => {
    const { redis, calls } = fakeRedis(() => Promise.resolve(0));
    const limiter = createOutboundLimiter({
      redis,
      name: 'leetcode',
      minIntervalMs: 1000,
      prefix: 'p',
    });
    expect(await limiter.acquire()).toBe(true);
    expect(calls[0]).toEqual(['p:ratelimit:outbound:leetcode', 1000, -1]);
  });

  it('passes the request-path budget', async () => {
    const { redis, calls } = fakeRedis(() => Promise.resolve(0));
    await createOutboundLimiter({ redis, name: 'x', minIntervalMs: 1 }).acquire({ maxWaitMs: 300 });
    expect(calls[0]?.[2]).toBe(300);
  });

  it('sleeps for the wait that Redis returns', async () => {
    vi.useFakeTimers();
    const { redis } = fakeRedis(() => Promise.resolve(500));
    const pending = createOutboundLimiter({ redis, name: 'x', minIntervalMs: 1 }).acquire();
    let done = false;
    void pending.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toBe(true);
  });

  it('returns false at once when the budget would be exceeded', async () => {
    const { redis } = fakeRedis(() => Promise.resolve(-1));
    expect(
      await createOutboundLimiter({ redis, name: 'x', minIntervalMs: 1 }).acquire({ maxWaitMs: 5 }),
    ).toBe(false);
  });

  it('throws RateLimiterUnavailableError when Redis fails (CACHE-009)', async () => {
    const { redis } = fakeRedis(() => Promise.reject(new Error('ECONNREFUSED')));
    const limiter = createOutboundLimiter({ redis, name: 'x', minIntervalMs: 1 });
    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimiterUnavailableError);
  });
});
