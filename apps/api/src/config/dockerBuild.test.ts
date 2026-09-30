import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `npm ci` in the Docker image runs `prisma generate` (postinstall) before the rest of the source is
// copied, so every local file prisma.config.ts imports must be copied explicitly first.
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (path: string): string => readFileSync(`${repoRoot}${path}`, 'utf8');

describe('Dockerfile and prisma.config.ts', () => {
  const localImports = [...read('apps/api/prisma.config.ts').matchAll(/from '(\.[^']+)'/g)].map(
    (match) => `apps/api/${(match[1] ?? '').replace(/^\.\//, '').replace(/\.js$/, '.ts')}`,
  );
  const beforeNpmCi = read('Dockerfile').split('RUN npm ci')[0] ?? '';

  it('finds the local imports it is meant to check', () => {
    expect(localImports).toContain('apps/api/src/config/loadEnv.ts');
  });

  it.each(localImports)('copies %s before npm ci', (file) => {
    expect(beforeNpmCi).toContain(file);
  });
});
