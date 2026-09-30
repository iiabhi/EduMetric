import { setTimeout as sleep } from 'node:timers/promises';
import { noopJob } from '../definitions.js';
import { defineHandler } from '../worker.js';

/** Example job: waits `delayMs` (used to test graceful shutdown), then logs. Idempotent by nature. */
export const noopHandler = defineHandler(noopJob, async (payload, { log }) => {
  if (payload.delayMs !== undefined && payload.delayMs > 0) await sleep(payload.delayMs);
  log.info('No-op job done');
});
