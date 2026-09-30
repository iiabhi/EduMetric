import { loadConfigOrExit } from '../config/index.js';
import { noopJob } from '../jobs/definitions.js';
import { createJobQueue } from '../jobs/jobQueue.js';
import { createLogger } from '../lib/logger.js';
import { createRedisClient } from '../lib/redis.js';

// Enqueue one no-op job and exit. Used by scripts/compose-smoke.sh and for manual checks:
//   docker compose exec api npx tsx apps/api/src/cli/enqueueNoop.ts [delayMs]
const delayMs = process.argv[2] === undefined ? undefined : Number(process.argv[2]);

const config = loadConfigOrExit();
const logger = createLogger(config);
const redis = createRedisClient(config, logger, 'bullmq');
const jobs = createJobQueue({ redis });

try {
  const jobId = await jobs.enqueue(noopJob, delayMs === undefined ? {} : { delayMs });
  logger.info({ jobId }, 'Enqueued no-op job');
} catch (err) {
  logger.error({ err }, 'Could not enqueue the no-op job');
  process.exitCode = 1;
} finally {
  await jobs.close();
  await redis.quit();
}
