import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedSrc = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));
const alias = { '@edumetrics/shared': sharedSrc };

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'lcov'],
      include: ['apps/api/src/**/*.ts', 'packages/shared/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.int.test.ts',
        '**/test-utils/**',
        '**/types/**',
        '**/generated/**',
        'apps/api/src/server.ts',
        'apps/api/src/worker.ts',
        'apps/api/src/cli/**',
        'apps/api/src/db/seed/run.ts',
        'apps/api/src/config/index.ts',
        '**/index.ts',
      ],
      thresholds: { lines: 80 },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['apps/**/src/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
          exclude: ['**/*.int.test.ts', '**/node_modules/**'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['apps/**/src/**/*.int.test.ts'],
          testTimeout: 30_000,
          fileParallelism: false,
          env: { TZ: 'Asia/Kolkata' },
          globalSetup: ['apps/api/src/test-utils/integration-setup.ts'],
        },
      },
    ],
  },
});
