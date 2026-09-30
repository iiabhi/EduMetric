import { setTimeout as sleep } from 'node:timers/promises';
import type { RedisClient } from './redis.js';

/** Thrown when Redis cannot be reached, so the caller decides the fallback (serve stale, retry the job). */
export class RateLimiterUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Outbound rate limiter is unavailable', { cause });
    this.name = 'RateLimiterUnavailableError';
  }
}

export interface OutboundLimiterOptions {
  redis: RedisClient;
  /** Identifies the provider, e.g. "codeforces". Built from code constants, never from user input. */
  name: string;
  /** Minimum time between two calls across every process that uses this name. */
  minIntervalMs: number;
  /** Redis key prefix. Tests use a unique one. */
  prefix?: string;
}

export interface AcquireOptions {
  /**
   * Request path: the longest this call may wait for its turn. If the next free slot is further away,
   * `acquire` returns false and reserves nothing, and the caller serves the stale snapshot.
   * Background jobs leave it out and wait as long as needed (CACHE-011).
   */
  maxWaitMs?: number;
}

interface SlotCommand {
  acquireOutboundSlot: (key: string, minIntervalMs: number, maxWaitMs: number) => Promise<number>;
}

// Runs atomically on the Redis server, using the server clock so no two machines need to agree on
// the time. KEYS[1] holds the time the next call may start. Returns how long to wait in ms, or -1
// when that wait is longer than ARGV[2] (a negative ARGV[2] means "no limit").
const ACQUIRE_SLOT_LUA = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local interval = tonumber(ARGV[1])
local maxWait = tonumber(ARGV[2])
local nextFree = tonumber(redis.call('GET', KEYS[1])) or 0
local slot = math.max(now, nextFree)
local wait = slot - now
if maxWait >= 0 and wait > maxWait then
  return -1
end
redis.call('SET', KEYS[1], slot + interval, 'PX', wait + interval + 1000)
return wait
`;

/**
 * Redis-backed limiter shared by the API and the worker (CACHE-011): at most one call per
 * `minIntervalMs` for the whole deployment. Each caller reserves the next slot and sleeps until it.
 */
export const createOutboundLimiter = ({
  redis,
  name,
  minIntervalMs,
  prefix = 'edumetrics',
}: OutboundLimiterOptions) => {
  redis.defineCommand('acquireOutboundSlot', { numberOfKeys: 1, lua: ACQUIRE_SLOT_LUA });
  const key = `${prefix}:ratelimit:outbound:${name}`;
  // defineCommand above adds this method to the client.
  const commands = redis as unknown as SlotCommand;

  return {
    /** Resolves true once it is this caller's turn, or false if `maxWaitMs` would be exceeded. */
    async acquire({ maxWaitMs }: AcquireOptions = {}): Promise<boolean> {
      let waitMs: number;
      try {
        waitMs = await commands.acquireOutboundSlot(key, minIntervalMs, maxWaitMs ?? -1);
      } catch (err) {
        throw new RateLimiterUnavailableError(err);
      }
      if (waitMs < 0) return false;
      if (waitMs > 0) await sleep(waitMs);
      return true;
    },
  };
};

export type OutboundLimiter = ReturnType<typeof createOutboundLimiter>;
