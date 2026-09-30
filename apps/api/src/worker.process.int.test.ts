import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { noopJob } from './jobs/definitions.js';
import { createJobQueue, type JobQueue } from './jobs/jobQueue.js';
import type { RedisClient } from './lib/redis.js';
import {
  createTestRedis,
  deleteKeysWithPrefix,
  testRedisUrl,
  waitFor,
} from './test-utils/redis.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const workerEntry = join(repoRoot, 'apps/api/src/worker.ts');

// The real worker uses the default "bull" key prefix, so this file cleans up only the queue it uses.
// ENV_FILE points at a missing file, so a developer's real .env cannot fill in variables.
const noEnvFile = join(mkdtempSync(join(tmpdir(), 'edumetrics-worker-')), 'no-such.env');

interface Running {
  child: ChildProcess;
  lines: () => string[];
  exit: Promise<number | null>;
}

const startWorker = (redisUrl = testRedisUrl()): Running => {
  // `node --import tsx` runs one process, so signals reach the worker itself (the `tsx` wrapper would
  // leave an orphan behind on SIGKILL).
  const child = spawn(process.execPath, ['--import', 'tsx', workerEntry], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH ?? '',
      ENV_FILE: noEnvFile,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      APP_BASE_URL: 'http://localhost:5173',
      CORS_ORIGINS: 'http://localhost:5173',
      DATABASE_URL: 'mysql://user:pass@localhost:3306/edumetrics_test',
      REDIS_URL: redisUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  const exit = new Promise<number | null>((resolve) =>
    child.on('exit', (code) => {
      resolve(code);
    }),
  );
  return { child, lines: () => output.split('\n').filter(Boolean), exit };
};

describe('worker process (acceptance)', () => {
  let redis: RedisClient;
  let jobs: JobQueue;
  const running: Running[] = [];

  beforeAll(() => {
    redis = createTestRedis('bullmq');
    jobs = createJobQueue({ redis });
  });

  afterEach(() => {
    for (const r of running.splice(0)) r.child.kill('SIGKILL');
  });

  afterAll(async () => {
    await jobs.queue('maintenance').obliterate({ force: true });
    await jobs.close();
    await deleteKeysWithPrefix(redis, 'bull');
    await redis.quit();
  });

  const launch = async (redisUrl?: string): Promise<Running> => {
    const r = startWorker(redisUrl);
    running.push(r);
    await waitFor(() => r.lines().some((l) => l.includes('Worker ready')), 20_000);
    return r;
  };

  it('processes a job enqueued by the API side (JOB-003..005)', async () => {
    await launch();
    const id = await jobs.enqueue(noopJob, {});
    await waitFor(async () => (await jobs.queue('maintenance').getJobState(id)) === 'completed');
  });

  it('SIGTERM finishes the in-flight job before exiting (JOB-014)', async () => {
    const worker = await launch();
    const id = await jobs.enqueue(noopJob, { delayMs: 2000 });
    await waitFor(() => worker.lines().some((l) => l.includes(`"jobId":"${id}"`)));
    const signalledAt = Date.now();
    worker.child.kill('SIGTERM');

    expect(await worker.exit).toBe(0);
    expect(Date.now() - signalledAt).toBeGreaterThan(500);
    expect(await jobs.queue('maintenance').getJobState(id)).toBe('completed');
    expect(worker.lines().some((l) => l.includes('Worker stopped'))).toBe(true);
  });

  it('an idle worker exits promptly on SIGTERM', async () => {
    const worker = await launch();
    worker.child.kill('SIGTERM');
    expect(await worker.exit).toBe(0);
  });

  it('starts while Redis is unreachable, logs errors and keeps running (REL-001)', async () => {
    const r = startWorker('redis://:pw-secret@127.0.0.1:1');
    running.push(r);
    await waitFor(() => r.lines().some((l) => l.includes('error')), 20_000);
    expect(r.child.exitCode).toBeNull();
    expect(r.lines().join('\n')).not.toContain('pw-secret');
  });
});
