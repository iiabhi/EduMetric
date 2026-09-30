import { describe, expect, it, vi } from 'vitest';
import { runSeeders, type Seeder } from './index.js';

const db = {} as Parameters<typeof runSeeders>[0];

const seeder = (name: string, created: number, calls: string[]): Seeder => ({
  name,
  run: () => {
    calls.push(name);
    return Promise.resolve({ created });
  },
});

describe('runSeeders', () => {
  it('runs the seeders in order and reports counts only', async () => {
    const calls: string[] = [];
    const log = vi.fn();
    await runSeeders(db, [seeder('first', 1, calls), seeder('second', 0, calls)], {
      nodeEnv: 'development',
      log,
    });
    expect(calls).toEqual(['first', 'second']);
    expect(log.mock.calls).toEqual([['first: created 1'], ['second: created 0']]);
  });

  it.each(['development', 'test'])('runs when NODE_ENV=%s', async (nodeEnv) => {
    const calls: string[] = [];
    await runSeeders(db, [seeder('first', 1, calls)], { nodeEnv });
    expect(calls).toEqual(['first']);
  });

  // An allow-list, not "anything but production" (DB-008): unknown or staging-like values refuse too.
  it.each(['production', 'staging', 'Production', ''])(
    'refuses NODE_ENV=%j and writes nothing (DB-008)',
    async (nodeEnv) => {
      const calls: string[] = [];
      await expect(runSeeders(db, [seeder('first', 1, calls)], { nodeEnv })).rejects.toThrow(
        /development or test/,
      );
      expect(calls).toEqual([]);
    },
  );

  it('stops at the first failing seeder and surfaces its error', async () => {
    const calls: string[] = [];
    const failing: Seeder = { name: 'bad', run: () => Promise.reject(new Error('boom')) };
    await expect(
      runSeeders(db, [failing, seeder('after', 1, calls)], { nodeEnv: 'test' }),
    ).rejects.toThrow('boom');
    expect(calls).toEqual([]);
  });
});
