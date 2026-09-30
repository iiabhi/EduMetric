import { z } from 'zod';
import type { QueueName } from '../config/env.js';

/**
 * A job type: which queue it runs on, its name, and the Zod schema of its payload. Payloads hold
 * IDs or small values only (JOB-010). The schema is checked when the job is enqueued and again in
 * the worker before the handler runs.
 */
export interface JobDefinition<S extends z.ZodType = z.ZodType> {
  queue: QueueName;
  name: string;
  payload: S;
}

export const defineJob = <S extends z.ZodType>(
  queue: QueueName,
  name: string,
  payload: S,
): JobDefinition<S> => ({ queue, name, payload });

export const NOOP_MAX_DELAY_MS = 5000;

/** Example job (F-04). The delay is capped so a payload cannot hold a worker slot for long. */
export const noopJob = defineJob(
  'maintenance',
  'noop',
  z.strictObject({ delayMs: z.number().int().min(0).max(NOOP_MAX_DELAY_MS).optional() }),
);
