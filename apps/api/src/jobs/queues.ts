import type { DefaultJobOptions } from 'bullmq';

const SECONDS_PER_DAY = 86_400;

/** Default retry and cleanup policy for every queue (JOB-009, JOB-013). */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: SECONDS_PER_DAY },
  removeOnFail: { age: 7 * SECONDS_PER_DAY },
} as const satisfies DefaultJobOptions;
