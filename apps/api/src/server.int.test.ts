import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const tsx = join(repoRoot, 'node_modules/.bin/tsx');
const serverEntry = join(repoRoot, 'apps/api/src/server.ts');

const validEnv = {
  APP_BASE_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'mysql://user:secret-pass@localhost:3306/edumetrics',
  REDIS_URL: 'redis://localhost:6379',
};

// Run from an empty directory so a developer's local .env cannot fill in missing variables.
const emptyCwd = mkdtempSync(join(tmpdir(), 'edumetrics-cfg-'));

const runServer = (env: Record<string, string>) =>
  spawnSync(tsx, [serverEntry], {
    cwd: emptyCwd,
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 20_000,
  });

describe('server startup config (acceptance)', () => {
  it('exits non-zero and names the missing variable', () => {
    const withoutDatabaseUrl = Object.fromEntries(
      Object.entries(validEnv).filter(([name]) => name !== 'DATABASE_URL'),
    );
    const result = runServer(withoutDatabaseUrl);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid environment configuration');
    expect(result.stderr).toContain('DATABASE_URL');
  });

  it('exits non-zero when several variables are missing and lists all of them', () => {
    const result = runServer({});
    expect(result.status).toBe(1);
    for (const name of ['APP_BASE_URL', 'CORS_ORIGINS', 'DATABASE_URL', 'REDIS_URL']) {
      expect(result.stderr).toContain(name);
    }
  });

  it('never prints variable values', () => {
    const result = runServer({ ...validEnv, DATABASE_URL: 'postgres://u:secret-pass@h/db' });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('secret-pass');
  });

  it('rejects NODE_ENV=production with NEWS_PROVIDER=mock', () => {
    const result = runServer({ ...validEnv, NODE_ENV: 'production', NEWS_PROVIDER: 'mock' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NEWS_PROVIDER');
    expect(result.stderr).toMatch(/mock/);
    expect(result.stderr).toContain('production');
  });
});

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const address = srv.address();
      srv.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('no port'));
      });
    });
  });

describe('server runtime', () => {
  it('starts, answers /healthz and shuts down cleanly on SIGTERM', async () => {
    const port = await freePort();
    const child = spawn(tsx, [serverEntry], {
      cwd: emptyCwd,
      env: { PATH: process.env.PATH ?? '', ...validEnv, PORT: String(port), LOG_LEVEL: 'info' },
    });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    const exited = new Promise<number | null>((resolve) => {
      child.on('exit', (code) => {
        resolve(code);
      });
    });

    const started = Date.now();
    while (!stdout.includes('API listening') && Date.now() - started < 15_000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(stdout).toContain('API listening');

    const res = await fetch(`http://127.0.0.1:${String(port)}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { status: 'ok' } });

    child.kill('SIGTERM');
    expect(await exited).toBe(0);
  });
});
