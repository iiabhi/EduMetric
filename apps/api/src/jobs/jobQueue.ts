import { Queue, type DefaultJobOptions } from 'bullmq';
import type { z } from 'zod';
import type { QueueName } from '../config/env.js';
import type { RedisClient } from '../lib/redis.js';
import type { JobDefinition } from './definitions.js';
import { DEFAULT_JOB_OPTIONS } from './queues.js';

export interface EnqueueOptions {
  /**
   * Deterministic ID so the same subject is queued once (JOB-006). BullMQ rejects IDs containing ":"
   * and integer-only IDs, so use e.g. `news-summary-<articleId>`, not the SRD's `news-summary:<id>`.
   */
  jobId?: string;
  delayMs?: number;
}

export interface RepeatSchedule {
  /** Run every N milliseconds. */
  everyMs?: number;
  /** Or a cron pattern. */
  pattern?: string;
}

export interface JobQueueOptions {
  redis: RedisClient;
  /** Key prefix in Redis. Tests use a unique one. */
  prefix?: string;
  /** Overrides DEFAULT_JOB_OPTIONS (tests use a short backoff). */
  defaultJobOptions?: DefaultJobOptions;
}

/**
 * Producer side of the queues (JOB-004): validates the payload, adds the job, returns at once.
 * Services depend on this small interface, not on BullMQ (SRD 7.2).
 */
export const createJobQueue = ({ redis, prefix, defaultJobOptions }: JobQueueOptions) => {
  const queues = new Map<QueueName, Queue>();

  const queueFor = (name: QueueName): Queue => {
    let queue = queues.get(name);
    if (queue === undefined) {
      queue = new Queue(name, {
        connection: redis,
        ...(prefix === undefined ? {} : { prefix }),
        defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...defaultJobOptions },
      });
      queues.set(name, queue);
    }
    return queue;
  };

  return {
    /** Add a job. Returns its ID. Throws a ZodError if the payload does not match the definition. */
    async enqueue<S extends z.ZodType>(
      definition: JobDefinition<S>,
      payload: z.input<S>,
      options: EnqueueOptions = {},
    ): Promise<string> {
      const data = definition.payload.parse(payload);
      const job = await queueFor(definition.queue).add(definition.name, data, {
        ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
        ...(options.delayMs === undefined ? {} : { delay: options.delayMs }),
      });
      return job.id ?? '';
    },

    /** Create or update a repeating job. Safe to call on every startup: the scheduler ID makes it idempotent. */
    async upsertRepeatable<S extends z.ZodType>(
      definition: JobDefinition<S>,
      payload: z.input<S>,
      schedulerId: string,
      schedule: RepeatSchedule,
    ): Promise<void> {
      const data = definition.payload.parse(payload);
      const repeat =
        schedule.pattern === undefined
          ? { every: schedule.everyMs ?? 0 }
          : { pattern: schedule.pattern };
      await queueFor(definition.queue).upsertJobScheduler(schedulerId, repeat, {
        name: definition.name,
        data,
      });
    },

    /** The BullMQ queue, for inspection (tests, future admin tooling). */
    queue: queueFor,

    async close(): Promise<void> {
      await Promise.all([...queues.values()].map((q) => q.close()));
      queues.clear();
    },
  };
};

export type JobQueue = ReturnType<typeof createJobQueue>;
