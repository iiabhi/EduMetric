import { createPrismaClient } from '../lib/prisma.js';
import { testConfig } from './config.js';

const COMPOSE_TEST_DATABASE_URL = 'mysql://root@127.0.0.1:3307/edumetrics_test';

const databaseName = (url: string): string => new URL(url).pathname.replace(/^\//, '');

/**
 * Database used by integration tests. DATABASE_URL when its database name ends in `_test` (CI),
 * otherwise the compose test profile. Anything else is refused so a dev database is never wiped.
 */
export const testDatabaseUrl = (env: Record<string, string | undefined> = process.env): string => {
  const fromEnv = env.DATABASE_URL;
  const url =
    fromEnv !== undefined && databaseName(fromEnv).endsWith('_test')
      ? fromEnv
      : COMPOSE_TEST_DATABASE_URL;
  if (!databaseName(url).endsWith('_test')) {
    throw new Error('Refusing to use a database whose name does not end in _test');
  }
  return url;
};

export const createTestPrisma = () =>
  createPrismaClient(testConfig({ DATABASE_URL: testDatabaseUrl() }));

export type TestPrisma = ReturnType<typeof createTestPrisma>;

/** Users own every other identity row (ON DELETE CASCADE), so deleting them clears the tables. */
export const clearDatabase = async (prisma: TestPrisma): Promise<void> => {
  await assertTestDatabase(prisma);
  await prisma.user.deleteMany();
};

/**
 * Asks the server which database this connection is using and refuses unless its name ends in
 * `_test`. Checked on every cleanup, so it holds even for a client built some other way.
 */
export const assertTestDatabase = async (prisma: Pick<TestPrisma, '$queryRaw'>): Promise<void> => {
  const rows = await prisma.$queryRaw<{ name: string | null }[]>`SELECT DATABASE() AS name`;
  const name = rows[0]?.name ?? '';
  if (!name.endsWith('_test')) {
    throw new Error('Refusing to clear a database whose name does not end in _test');
  }
};
