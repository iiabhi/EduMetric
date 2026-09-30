import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Builds a throwaway copy of the repo layout (tmp/.env, tmp/apps/api/...) so the real .env is never
// touched. The copied files resolve the root .env from their own location, exactly like the real ones.
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const tsx = join(repoRoot, 'node_modules/.bin/tsx');

const root = mkdtempSync(join(tmpdir(), 'edumetrics-rootenv-'));
const apiDir = join(root, 'apps/api');
mkdirSync(join(apiDir, 'src/config'), { recursive: true });
writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
symlinkSync(join(repoRoot, 'node_modules'), join(root, 'node_modules'));
for (const file of ['env.ts', 'index.ts', 'loadEnv.ts']) {
  cpSync(join(repoRoot, 'apps/api/src/config', file), join(apiDir, 'src/config', file));
}
cpSync(join(repoRoot, 'apps/api/prisma.config.ts'), join(apiDir, 'prisma.config.ts'));
writeFileSync(
  join(root, '.env'),
  [
    'APP_BASE_URL=http://localhost:5173',
    'CORS_ORIGINS=http://localhost:5173',
    'DATABASE_URL=mysql://file:pw@localhost:3306/from_root_env',
    'REDIS_URL=redis://localhost:6379',
  ].join('\n'),
);
writeFileSync(
  join(apiDir, 'app-probe.ts'),
  `import { loadConfigOrExit } from './src/config/index.js';
console.log(JSON.stringify({ databaseUrl: loadConfigOrExit().databaseUrl }));
`,
);
writeFileSync(
  join(apiDir, 'prisma-probe.ts'),
  `import config from './prisma.config.js';
console.log(JSON.stringify({ url: config.datasource?.url }));
`,
);

// cwd is apps/api, the directory npm runs workspace scripts in. Only PATH plus `extra` is set.
const run = (script: string, extra: Record<string, string> = {}) => {
  const result = spawnSync(tsx, [script], {
    cwd: apiDir,
    env: { PATH: process.env.PATH ?? '', ...extra },
    encoding: 'utf8',
    timeout: 30_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim()) as Record<string, string>;
};

describe('root .env loading, started from apps/api with only the root .env present', () => {
  it('(a) the API config loads successfully', () => {
    expect(run('app-probe.ts').databaseUrl).toContain('from_root_env');
  });

  it('(b) an existing environment variable is not overridden by the file', () => {
    const url = 'mysql://real:pw@prod-host:3306/from_environment';
    expect(run('app-probe.ts', { DATABASE_URL: url }).databaseUrl).toBe(url);
  });

  it('(c) the Prisma config resolves DATABASE_URL the same way', () => {
    expect(run('prisma-probe.ts').url).toContain('from_root_env');
    const url = 'mysql://real:pw@prod-host:3306/from_environment';
    expect(run('prisma-probe.ts', { DATABASE_URL: url }).url).toBe(url);
  });

  it('NODE_ENV=production: the root .env is not read by the API config or the Prisma config', () => {
    const prod = { NODE_ENV: 'production' };
    const api = spawnSync(tsx, ['app-probe.ts'], {
      cwd: apiDir,
      env: { PATH: process.env.PATH ?? '', ...prod },
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(api.status).toBe(1); // required variables are missing, and the file did not supply them
    expect(api.stderr).not.toContain('from_root_env');
    expect(run('prisma-probe.ts', prod).url).toBe('');
  });

  it('NODE_ENV=production: ENV_FILE is ignored too', () => {
    const extra = join(root, 'extra.env');
    writeFileSync(extra, 'DATABASE_URL=mysql://x:pw@h:3306/from_extra\n');
    expect(run('prisma-probe.ts', { NODE_ENV: 'production', ENV_FILE: extra }).url).toBe('');
  });
});
