import { defineConfig } from 'prisma/config';
import { loadEnvFile } from './src/config/loadEnv.js';

// The same .env loading as the API (repo-root file, real environment variables win).
loadEnvFile();

// url is optional so `prisma generate` and `prisma validate` work without a database (CI, Docker build).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/db/seed/run.ts',
  },
  // shadowDatabaseUrl is set only by scripts/db-check-migrations.sh; migrate dev creates its own shadow DB.
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
