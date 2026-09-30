import { UnrecoverableError } from 'bullmq';
import type * as BullMq from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import type { RedisClient } from '../lib/redis.js';
import { testConfig } from '../test-utils/config.js';
import { LogCapture } from '../test-utils/log-capture.js';
import { defineJob } from './definitions.js';
import { NonRetryableJobError } from './errors.js';

interface FakeWorker {
  queue: string;
  processor: (job: unknown) => Promise<void>;
  options: { concurrency: number };
  handlers: Map<string, (arg: unknown) => void>;
  close: ReturnType<typeof vi.fn>;
  waitUntilReady: ReturnType<typeof vi.fn>;
}

const created: FakeWorker[] = [];

vi.mock('bullmq', async (importOriginal) => {
  const actual = await importOriginal<typeof BullMq>();
  class Worker {
    handlers = new Map<string, (arg: unknown) => void>();
    close = vi.fn(() => Promise.resolve());
    waitUntilReady = vi.fn(() => Promise.resolve());
    constructor(
      public queue: string,
      public processor: (job: unknown) => Promise<void>,
      public options: { concurrency: number },
    ) {
      created.push(this);
    }
    on(event: string, handler: (arg: unknown) => void) {
      this.handlers.set(event, handler);
    }
  }
  return { ...actual, Worker };
});

const { startWorkers, defineHandler } = await import('./worker.js');

const concurrency = {
  email: 3,
  'coding-refresh': 2,
  'news-ingest': 2,
  'news-summary': 2,
  'prep-plan': 2,
  'pdf-render': 2,
  maintenance: 7,
};

const job = defineJob('maintenance', 'demo', z.strictObject({ id: z.string() }));
const emailJob = defineJob('email', 'send', z.strictObject({ id: z.string() }));

const fakeJob = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  name: 'demo',
  data: { id: 'secret-marker' },
  attemptsMade: 0,
  opts: { attempts: 3 },
  ...over,
});

const setup = (run: () => Promise<void>) => {
  const out = new LogCapture();
  const logger = createLogger(testConfig({ LOG_LEVEL: 'info' }), out);
  const workers = startWorkers({
    redis: {} as RedisClient,
    logger,
    handlers: [defineHandler(job, run)],
    concurrency,
  });
  const worker = created.at(-1);
  if (worker === undefined) throw new Error('no worker was created');
  return { out, worker, workers };
};

beforeEach(() => {
  created.length = 0;
});

describe('startWorkers', () => {
  it('creates a worker only for queues that have handlers, with the configured concurrency (JOB-012)', () => {
    const { worker, workers } = setup(() => Promise.resolve());
    expect(created).toHaveLength(1);
    expect(worker.queue).toBe('maintenance');
    expect(worker.options.concurrency).toBe(7);
    expect(workers.queues).toEqual(['maintenance']);
  });

  it('creates one worker per queue when handlers span queues', () => {
    startWorkers({
      redis: {} as RedisClient,
      logger: createLogger(testConfig({ LOG_LEVEL: 'silent' })),
      handlers: [
        defineHandler(job, () => Promise.resolve()),
        defineHandler(emailJob, () => Promise.resolve()),
      ],
      concurrency,
    });
    expect(created.map((w) => [w.queue, w.options.concurrency]).sort()).toEqual([
      ['email', 3],
      ['maintenance', 7],
    ]);
  });

  it('logs start and completion with queue, job ID and attempt, but not the payload (SEC-014)', async () => {
    const { out, worker } = setup(() => Promise.resolve());
    await worker.processor(fakeJob({ attemptsMade: 1 }));
    const lines = out.lines;
    expect(lines.map((l) => l.msg)).toEqual(['Job started', 'Job completed']);
    expect(lines[1]).toMatchObject({
      queue: 'maintenance',
      jobId: 'job-1',
      jobName: 'demo',
      attempt: 2,
    });
    expect(lines[1]?.durationMs).toBeTypeOf('number');
    expect(out.raw).not.toContain('secret-marker');
  });

  it('logs a retryable failure at warn and rethrows so BullMQ retries (JOB-008)', async () => {
    const { out, worker } = setup(() => Promise.reject(new Error('boom')));
    await expect(worker.processor(fakeJob())).rejects.toThrow('boom');
    const failed = out.lines.find((l) => l.msg === 'Job failed');
    expect(failed).toMatchObject({ level: 40, willRetry: true });
    expect(out.raw).not.toContain('secret-marker');
  });

  it('logs the final failure at error when no attempts are left', async () => {
    const { out, worker } = setup(() => Promise.reject(new Error('boom')));
    await expect(worker.processor(fakeJob({ attemptsMade: 2 }))).rejects.toThrow('boom');
    expect(out.lines.find((l) => l.msg === 'Job failed')).toMatchObject({
      level: 50,
      willRetry: false,
    });
  });

  it('does not retry a NonRetryableJobError (JOB-009)', async () => {
    const { out, worker } = setup(() => Promise.reject(new NonRetryableJobError('no such user')));
    const error = await worker.processor(fakeJob()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(out.lines.find((l) => l.msg === 'Job failed')).toMatchObject({
      level: 50,
      willRetry: false,
    });
  });

  it('fails an invalid payload as non-retryable without calling the handler', async () => {
    const run = vi.fn(() => Promise.resolve());
    const { worker } = setup(run);
    const error = await worker.processor(fakeJob({ data: { id: 1 } })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(run).not.toHaveBeenCalled();
  });

  it('fails an unknown job name as non-retryable', async () => {
    const { worker } = setup(() => Promise.resolve());
    const error = await worker.processor(fakeJob({ name: 'other' })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
  });

  it('handles the worker error event by logging, not throwing (REL-001)', () => {
    const { out, worker } = setup(() => Promise.resolve());
    expect(() => worker.handlers.get('error')?.(new Error('redis gone'))).not.toThrow();
    expect(out.lines.some((l) => l.msg === 'Worker error')).toBe(true);
  });

  it('close() closes every worker and ready() waits for them', async () => {
    const { worker, workers } = setup(() => Promise.resolve());
    await workers.ready();
    await workers.close();
    expect(worker.waitUntilReady).toHaveBeenCalled();
    expect(worker.close).toHaveBeenCalled();
  });
});
