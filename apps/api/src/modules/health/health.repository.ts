import type { DbClient } from '../../lib/transaction.js';

/** The only database access /readyz needs: a query that proves MySQL answers. */
export const createHealthRepository = (db: DbClient) => ({
  async ping(): Promise<void> {
    await db.$queryRaw`SELECT 1`;
  },
});

export type HealthRepository = ReturnType<typeof createHealthRepository>;
