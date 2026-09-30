import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type { z } from 'zod';
import type { QueueName } from '../config/env.js';
import type { Logger } from '../lib/logger.js';
import { createThrottledWarn, type RedisClient } from '../lib/redis.js';
import type { JobDefinition } from './definitions.js';
import { NonRetryableJobError } from './errors.js';

export interface JobContext {
  /** Logger that already carries queue, jobId, jobName and attempt. */
  log: Logger;
}

export interface JobHandler {
  definition: JobDefinition;
  run: (payload: unknown, ctx: JobContext) => Promise<void>;
}

/**
 * Pair a job definition with its processor. Handlers must be idempotent (JOB-015): BullMQ may run a
 * job again after a stall or a crash.
 */
export const defineHandler = <S extends z.ZodType>(
  definition: JobDefinition<S>,
  run: (payload: z.output<S>, ctx: JobContext) => Promise<void>,
): JobHandler => ({
  definition,
  // The runner validates the payload with definition.payload before calling run.
  run: (payload, ctx) => run(payload as z.output<S>, ctx),
});

export interface StartWorkersOptions {
  redis: RedisClient;
  logger: Logger;
  handlers: JobHandler[];
  concurrency: Record<QueueName, number>;
  prefix?: string;
}

const attemptsLeft = (job: Job): boolean => job.attemptsMade + 1 < (job.opts.attempts ?? 1);

/**
 * One BullMQ Worker per queue that has handlers (JOB-003, JOB-012). Logs start, completion and
 * failure with the job ID; never logs the payload (SEC-014).
 */
export const startWorkers = ({
  redis,
  logger,
  handlers,
  concurrency,
  prefix,
}: StartWorkersOptions) => {
  const byQueue = new Map<QueueName, Map<string, JobHandler>>();
  for (const handler of handlers) {
    const queueHandlers = byQueue.get(handler.definition.queue) ?? new Map<string, JobHandler>();
    queueHandlers.set(handler.definition.name, handler);
    byQueue.set(handler.definition.queue, queueHandlers);
  }

  const warn = createThrottledWarn(logger);

  const workers = [...byQueue.entries()].map(([queue, queueHandlers]) => {
    const worker = new Worker(
      queue,
      async (job) => {
        const log = logger.child({
          queue,
          jobId: job.id,
          jobName: job.name,
          attempt: job.attemptsMade + 1,
        });
        const started = Date.now();
        log.info('Job started');
        try {
          const handler = queueHandlers.get(job.name);
          if (handler === undefined) throw new NonRetryableJobError('No handler for this job name');
          const parsed = handler.definition.payload.safeParse(job.data);
          if (!parsed.success) throw new NonRetryableJobError('Invalid job payload');
          await handler.run(parsed.data, { log });
          log.info({ durationMs: Date.now() - started }, 'Job completed');
        } catch (err) {
          const retrying = !(err instanceof UnrecoverableError) && attemptsLeft(job);
          log[retrying ? 'warn' : 'error'](
            { err, durationMs: Date.now() - started, willRetry: retrying },
            'Job failed',
          );
          throw err;
        }
      },
      {
        connection: redis,
        concurrency: Object.entries(concurrency).find(([name]) => name === queue)?.[1] ?? 1,
        ...(prefix === undefined ? {} : { prefix }),
      },
    );
    worker.on('error', (err) => {
      warn(err, 'Worker error');
    });
    return worker;
  });

  return {
    queues: [...byQueue.keys()],
    /** Resolves when every worker is connected and polling. */
    ready: async (): Promise<void> => {
      await Promise.all(workers.map((w) => w.waitUntilReady()));
    },
    /** Stop taking jobs and wait for the ones in flight (JOB-014). */
    close: async (): Promise<void> => {
      await Promise.all(workers.map((w) => w.close()));
    },
  };
};

export type RunningWorkers = ReturnType<typeof startWorkers>;
