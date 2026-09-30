import { describe, expect, it } from 'vitest';
import { assertTestDatabase, testDatabaseUrl } from './db.js';

describe('testDatabaseUrl', () => {
  it('uses DATABASE_URL when the database name ends in _test', () => {
    const url = 'mysql://root:pw@127.0.0.1:3306/edumetrics_test';
    expect(testDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('falls back to the compose test profile for a dev database', () => {
    expect(testDatabaseUrl({ DATABASE_URL: 'mysql://u:p@localhost:3306/edumetrics' })).toBe(
      'mysql://root@127.0.0.1:3307/edumetrics_test',
    );
  });

  it('falls back when DATABASE_URL is unset', () => {
    expect(testDatabaseUrl({})).toContain('127.0.0.1:3307/edumetrics_test');
  });
});

describe('assertTestDatabase', () => {
  const fake = (name: string | null) =>
    ({ $queryRaw: () => Promise.resolve([{ name }]) }) as unknown as Parameters<
      typeof assertTestDatabase
    >[0];

  it('accepts a database whose name ends in _test', async () => {
    await expect(assertTestDatabase(fake('edumetrics_test'))).resolves.toBeUndefined();
  });

  it.each(['edumetrics', 'edumetrics_test_backup', 'test', '', null])(
    'refuses %j',
    async (name) => {
      await expect(assertTestDatabase(fake(name))).rejects.toThrow('_test');
    },
  );
});
