import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import type { RedisClient } from '../lib/redis.js';
import { testConfig } from '../test-utils/config.js';
import { LogCapture } from '../test-utils/log-capture.js';
import {
  createTestRedis,
  deleteKeysWithPrefix,
  newTestPrefix,
  waitFor,
} from '../test-utils/redis.js';
import { defineJob, noopJob } from './definitions.js';
import { NonRetryableJobError } from './errors.js';
import { createJobQueue, type JobQueue } from './jobQueue.js';
import { defineHandler, startWorkers, type RunningWorkers } from './worker.js';
import { noopHandler } from './processors/noop.js';

const concurrency = {
  email: 1,
  'coding-refresh': 1,
  'news-ingest': 1,
  'news-summary': 1,
  'prep-plan': 1,
  'pdf-render': 1,
  maintenance: 2,
};

// Test-only job types on the maintenance queue.
const flakyJob = defineJob(
  'maintenance',
  'flaky',
  z.strictObject({ key: z.string(), failTimes: z.number().int() }),
);
const brokenJob = defineJob('maintenance', 'broken', z.strictObject({ key: z.string() }));
const fatalJob = defineJob('maintenance', 'fatal', z.strictObject({ key: z.string() }));
const tickJob = defineJob('maintenance', 'tick', z.strictObject({}));
const parkedJob = defineJob('email', 'parked', z.strictObject({ id: z.string() }));

const calls = new Map<string, number>();
const bump = (key: string): number => {
  const n = (calls.get(key) ?? 0) + 1;
  calls.set(key, n);
  return n;
};

describe('job queue and worker (real Redis)', () => {
  const prefix = newTestPrefix();
  const logs = new LogCapture();
  let redis: RedisClient;
  let jobs: JobQueue;
  let workers: RunningWorkers;

  beforeAll(async () => {
    redis = createTestRedis('bullmq');
    jobs = createJobQueue({
      redis,
      prefix,
      defaultJobOptions: { backoff: { type: 'fixed', delay: 50 } },
    });
    workers = startWorkers({
      redis,
      logger: createLogger(testConfig({ LOG_LEVEL: 'info' }), logs),
      prefix,
      concurrency,
      handlers: [
        noopHandler,
        defineHandler(flakyJob, ({ key, failTimes }) => {
          if (bump(key) <= failTimes) return Promise.reject(new Error('flaky failure'));
          return Promise.resolve();
        }),
        defineHandler(brokenJob, ({ key }) => {
          bump(key);
          return Promise.reject(new Error('always fails'));
        }),
        defineHandler(fatalJob, ({ key }) => {
          bump(key);
          return Promise.reject(new NonRetryableJobError('user not found'));
        }),
        defineHandler(tickJob, () => {
          bump('tick');
          return Promise.resolve();
        }),
      ],
    });
    await workers.ready();
  });

  afterAll(async () => {
    await workers.close();
    await jobs.close();
    await deleteKeysWithPrefix(redis, prefix);
    await redis.quit();
  });

  const state = async (id: string) => await jobs.queue('maintenance').getJobState(id);

  it('processes an enqueued job (JOB-003..005)', async () => {
    const id = await jobs.enqueue(noopJob, { delayMs: 10 });
    await waitFor(async () => (await state(id)) === 'completed');
    const job = await jobs.queue('maintenance').getJob(id);
    expect(job?.name).toBe('noop');
  });

  it('a job failing twice then succeeding completes on attempt 3 (JOB-008, JOB-009)', async () => {
    const id = await jobs.enqueue(flakyJob, { key: 'flaky-ok', failTimes: 2 });
    await waitFor(async () => (await state(id)) === 'completed');
    expect(calls.get('flaky-ok')).toBe(3);
    const job = await jobs.queue('maintenance').getJob(id);
    expect(job?.attemptsMade).toBe(3);
  });

  it('a job that always fails ends in the failed set and can be retried (REL-003, REL-004)', async () => {
    const id = await jobs.enqueue(brokenJob, { key: 'broken' });
    await waitFor(async () => (await state(id)) === 'failed');
    expect(calls.get('broken')).toBe(3);
    const failed = await jobs.queue('maintenance').getFailed();
    const job = failed.find((j) => j.id === id);
    expect(job?.failedReason).toBe('always fails');

    await job?.retry();
    await waitFor(async () => calls.get('broken') === 4 && (await state(id)) !== 'active');
  });

  it('a failing job does not stop other jobs (REL-003)', async () => {
    await jobs.enqueue(brokenJob, { key: 'broken-2' });
    const ok = await jobs.enqueue(noopJob, {});
    await waitFor(async () => (await state(ok)) === 'completed');
  });

  it('a NonRetryableJobError fails after one attempt (JOB-009)', async () => {
    const id = await jobs.enqueue(fatalJob, { key: 'fatal' });
    await waitFor(async () => (await state(id)) === 'failed');
    expect(calls.get('fatal')).toBe(1);
  });

  it('logs with job ID and attempt, and never the payload (SEC-014)', async () => {
    const id = await jobs.enqueue(flakyJob, { key: 'secret-marker', failTimes: 1 });
    await waitFor(async () => (await state(id)) === 'completed');
    const mine = logs.lines.filter((l) => l.jobId === id);
    expect(mine.map((l) => l.msg)).toEqual([
      'Job started',
      'Job failed',
      'Job started',
      'Job completed',
    ]);
    expect(mine.map((l) => l.attempt)).toEqual([1, 1, 2, 2]);
    expect(mine.every((l) => l.queue === 'maintenance' && l.jobName === 'flaky')).toBe(true);
    expect(logs.raw).not.toContain('secret-marker');
  });

  it('the same deterministic jobId is queued once (JOB-006)', async () => {
    // No worker handles the email queue, so the jobs stay waiting.
    const first = await jobs.enqueue(parkedJob, { id: 'a' }, { jobId: 'parked-a' });
    const second = await jobs.enqueue(parkedJob, { id: 'a' }, { jobId: 'parked-a' });
    expect(second).toBe(first);
    const counts = await jobs.queue('email').getJobCounts('wait', 'delayed');
    expect((counts.wait ?? 0) + (counts.delayed ?? 0)).toBe(1);
  });

  it('BullMQ rejects a jobId with a colon, so the SRD example format is not usable', async () => {
    await expect(jobs.enqueue(parkedJob, { id: 'b' }, { jobId: 'news-summary:b' })).rejects.toThrow(
      /cannot contain :/,
    );
  });

  it('upsertRepeatable is idempotent and the worker runs the repeats (TD-006)', async () => {
    const schedule = { everyMs: 100 };
    await jobs.upsertRepeatable(tickJob, {}, 'tick-scheduler', schedule);
    await jobs.upsertRepeatable(tickJob, {}, 'tick-scheduler', schedule);
    const schedulers = await jobs.queue('maintenance').getJobSchedulers();
    expect(schedulers.filter((s) => s.key === 'tick-scheduler')).toHaveLength(1);
    await waitFor(() => (calls.get('tick') ?? 0) >= 3);
    await jobs.queue('maintenance').removeJobScheduler('tick-scheduler');
  });
});
