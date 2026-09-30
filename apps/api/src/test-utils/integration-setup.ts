import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testDatabaseUrl } from './db.js';

const apiDir = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

/** Vitest globalSetup for the integration project: bring the test database up to date. */
export default function setup(): void {
  execFileSync(`${repoRoot}node_modules/.bin/prisma`, ['migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}
