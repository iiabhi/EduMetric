import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfigOrExit } from './index.js';
import { loadEnvFile, resolveEnvFilePath, ROOT_ENV_PATH } from './loadEnv.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'edumetrics-env-'));

const envFile = (name: string, lines: string[]): string => {
  const path = join(dir, name);
  writeFileSync(path, `${lines.join('\n')}\n`);
  return path;
};

const requiredLines = [
  'APP_BASE_URL=http://localhost:5173',
  'CORS_ORIGINS=http://localhost:5173',
  'DATABASE_URL=mysql://file:pw@localhost:3306/from_file',
  'REDIS_URL=redis://localhost:6379',
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('ROOT_ENV_PATH', () => {
  it('is the repo-root .env, found from the file location, not the working directory', () => {
    expect(ROOT_ENV_PATH).toBe(join(repoRoot, '.env'));
  });
});

describe('loadEnvFile', () => {
  it('fills in variables that are not set', () => {
    const env: Record<string, string> = {};
    loadEnvFile({ env, path: envFile('fill.env', ['A=from-file', 'B=2']) });
    expect(env).toEqual({ A: 'from-file', B: '2' });
  });

  it('never overrides a variable that is already set (Docker, CI, production)', () => {
    const env: Record<string, string> = { DATABASE_URL: 'mysql://real:pw@prod/db', EMPTY: '' };
    loadEnvFile({
      env,
      path: envFile('win.env', [
        'DATABASE_URL=mysql://file:pw@localhost/x',
        'EMPTY=filled',
        'NEW=1',
      ]),
    });
    expect(env.DATABASE_URL).toBe('mysql://real:pw@prod/db');
    expect(env.EMPTY).toBe(''); // set, even if empty: still the environment's value
    expect(env.NEW).toBe('1');
  });

  it('continues silently when the file does not exist', () => {
    const env: Record<string, string> = { KEEP: 'x' };
    expect(() => {
      loadEnvFile({ env, path: join(dir, 'missing.env') });
    }).not.toThrow();
    expect(env).toEqual({ KEEP: 'x' });
  });

  it('uses ENV_FILE instead of the root file when it is set', () => {
    const env: Record<string, string> = { ENV_FILE: envFile('custom.env', ['FROM_CUSTOM=yes']) };
    loadEnvFile({ env });
    expect(env.FROM_CUSTOM).toBe('yes');
  });

  it('treats an empty ENV_FILE as unset instead of falling through to ./.env', () => {
    expect(resolveEnvFilePath({ ENV_FILE: '' })).toBe(ROOT_ENV_PATH);
    expect(resolveEnvFilePath({})).toBe(ROOT_ENV_PATH);
    expect(resolveEnvFilePath({ ENV_FILE: '/tmp/custom.env' })).toBe('/tmp/custom.env');
  });
});

describe('loadEnvFile in production', () => {
  it('reads no file when NODE_ENV=production, even with ENV_FILE or a path given', () => {
    const file = envFile('prod.env', ['FROM_FILE=leaked', 'DATABASE_URL=mysql://file:pw@h/x']);
    const viaEnvFile: Record<string, string> = { NODE_ENV: 'production', ENV_FILE: file };
    loadEnvFile({ env: viaEnvFile });
    expect(Object.keys(viaEnvFile).sort()).toEqual(['ENV_FILE', 'NODE_ENV']);

    const viaPath: Record<string, string> = { NODE_ENV: 'production' };
    loadEnvFile({ env: viaPath, path: file });
    expect(viaPath).toEqual({ NODE_ENV: 'production' });
  });

  it.each(['development', 'test'])('still loads the file when NODE_ENV=%s', (nodeEnv) => {
    const env: Record<string, string> = { NODE_ENV: nodeEnv };
    loadEnvFile({ env, path: envFile(`${nodeEnv}.env`, ['FROM_FILE=yes']) });
    expect(env.FROM_FILE).toBe('yes');
  });

  it('loadConfigOrExit does not fill missing variables from a file in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const name of ['APP_BASE_URL', 'CORS_ORIGINS', 'DATABASE_URL', 'REDIS_URL']) {
      vi.stubEnv(name, undefined);
    }
    vi.stubEnv('ENV_FILE', envFile('prod-config.env', requiredLines));
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    expect(() => loadConfigOrExit()).toThrow('exit'); // production config must come from the environment
  });
});

describe('loadConfigOrExit', () => {
  it('tops up the real environment from the env file, then validates', () => {
    for (const name of ['APP_BASE_URL', 'CORS_ORIGINS', 'DATABASE_URL', 'REDIS_URL']) {
      vi.stubEnv(name, undefined);
    }
    vi.stubEnv('ENV_FILE', envFile('config.env', requiredLines));
    expect(loadConfigOrExit().databaseUrl).toContain('from_file');
  });

  it('keeps an environment value over the file', () => {
    vi.stubEnv('ENV_FILE', envFile('config2.env', requiredLines));
    vi.stubEnv('DATABASE_URL', 'mysql://real:pw@host:3306/from_env');
    vi.stubEnv('APP_BASE_URL', 'http://localhost:5173');
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    expect(loadConfigOrExit().databaseUrl).toContain('from_env');
  });

  it('does not read any file when an explicit env object is passed', () => {
    vi.stubEnv('ENV_FILE', envFile('config3.env', requiredLines));
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    expect(() => loadConfigOrExit({})).toThrow('exit'); // nothing filled in, so validation fails
  });
});
