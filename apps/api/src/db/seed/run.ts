import { config as loadDotenv } from 'dotenv';
import { loadConfigOrExit } from '../../config/index.js';
import { createPrismaClient } from '../../lib/prisma.js';
import { allSeeders, runSeeders } from './index.js';

// Entry point for `npm run db:seed` (and `prisma db seed`).
loadDotenv({ quiet: true });
const config = loadConfigOrExit();
const db = createPrismaClient(config);

try {
  await runSeeders(db, allSeeders, {
    nodeEnv: config.env,
    log: (line) => {
      console.log(line);
    },
  });
} catch (error) {
  // Message only: never print the error object, which could carry connection details.
  console.error(`Seed failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
