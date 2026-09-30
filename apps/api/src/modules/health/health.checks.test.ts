import { describe, expect, it } from 'vitest';
import { buildReadinessChecks } from './health.checks.js';

const up = { ping: () => Promise.resolve() };
const redisUp = { ping: () => Promise.resolve('PONG' as const) };
const down = { ping: () => Promise.reject(new Error('connection refused')) };

const run = async (checks: ReturnType<typeof buildReadinessChecks>) =>
  await Promise.all(
    checks.map(async (c) => ({ name: c.name, ok: await c.check().catch(() => false) })),
  );

describe('buildReadinessChecks', () => {
  it('has a mysql and a redis check', () => {
    expect(buildReadinessChecks({ health: up, redis: redisUp }).map((c) => c.name)).toEqual([
      'mysql',
      'redis',
    ]);
  });

  it('passes when SELECT 1 and PING both answer', async () => {
    expect(await run(buildReadinessChecks({ health: up, redis: redisUp }))).toEqual([
      { name: 'mysql', ok: true },
      { name: 'redis', ok: true },
    ]);
  });

  it('fails only the mysql check when the database query fails', async () => {
    expect(await run(buildReadinessChecks({ health: down, redis: redisUp }))).toEqual([
      { name: 'mysql', ok: false },
      { name: 'redis', ok: true },
    ]);
  });

  it('fails only the redis check when PING fails or answers something else', async () => {
    expect(await run(buildReadinessChecks({ health: up, redis: down }))).toEqual([
      { name: 'mysql', ok: true },
      { name: 'redis', ok: false },
    ]);
    const odd = { ping: () => Promise.resolve('nope' as never) };
    expect((await run(buildReadinessChecks({ health: up, redis: odd })))[1]?.ok).toBe(false);
  });
});
