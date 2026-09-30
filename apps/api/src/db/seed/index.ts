import type { Db } from '../../lib/prisma.js';
import { demoStudentSeeder } from './demoStudent.js';

/**
 * A seeder creates one kind of dev data. It must be idempotent: running it again leaves existing
 * rows untouched. `created` is the number of rows it added on this run.
 */
export interface Seeder {
  name: string;
  run: (db: Db) => Promise<{ created: number }>;
}

export interface SeedOptions {
  nodeEnv: string;
  /** Receives one summary line per seeder. Counts only, never row contents (SEC-014). */
  log?: (line: string) => void;
}

/** Add new seeders to this list, in the order they must run. */
export const allSeeders: Seeder[] = [demoStudentSeeder];

const SEED_ENVS = new Set(['development', 'test']);

/**
 * Seed data is for local development and tests only (DB-008). An allow-list, not "anything but
 * production": any other NODE_ENV is refused before any write.
 */
export const runSeeders = async (
  db: Db,
  seeders: Seeder[],
  { nodeEnv, log }: SeedOptions,
): Promise<void> => {
  if (!SEED_ENVS.has(nodeEnv)) {
    throw new Error('Refusing to seed: NODE_ENV must be development or test');
  }
  for (const seeder of seeders) {
    const { created } = await seeder.run(db);
    log?.(`${seeder.name}: created ${String(created)}`);
  }
};
