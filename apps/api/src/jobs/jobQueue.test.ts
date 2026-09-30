import { describe, expect, it } from 'vitest';
import type { RedisClient } from '../lib/redis.js';
import { noopJob } from './definitions.js';
import { createJobQueue } from './jobQueue.js';

// Validation happens before anything touches Redis, so a stand-in client proves nothing was sent.
const untouchedRedis = new Proxy(
  {},
  {
    get: () => {
      throw new Error('Redis must not be used when the payload is invalid');
    },
  },
) as RedisClient;

describe('enqueue payload validation (JOB-010)', () => {
  const jobs = createJobQueue({ redis: untouchedRedis });

  it.each([
    ['unknown field', { delayMs: 1, extra: true }],
    ['delay over the cap', { delayMs: 5001 }],
    ['negative delay', { delayMs: -1 }],
    ['non-integer delay', { delayMs: 1.5 }],
    ['wrong type', { delayMs: '10' }],
  ])('rejects %s before adding anything to Redis', async (_name, payload) => {
    await expect(jobs.enqueue(noopJob, payload as never)).rejects.toThrow();
  });

  it('rejects an invalid payload for a repeatable job too', async () => {
    await expect(
      jobs.upsertRepeatable(noopJob, { delayMs: 9999 }, 'x', { everyMs: 1000 }),
    ).rejects.toThrow();
  });
});
