import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './env.js';

const valid = {
  APP_BASE_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'mysql://user:secret-pass@localhost:3306/edumetrics',
  REDIS_URL: 'redis://localhost:6379',
};

const errorOf = (env: Record<string, string | undefined>): ConfigError => {
  try {
    loadConfig(env);
  } catch (e) {
    if (e instanceof ConfigError) return e;
    throw e;
  }
  throw new Error('expected loadConfig to throw');
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(valid);
    expect(c).toMatchObject({
      env: 'development',
      port: 3000,
      dbPoolSize: 10,
      dbAcquireTimeoutMs: 3000,
      logLevel: 'info',
      newsProvider: 'none',
      aiProvider: 'none',
      videoSearchProvider: 'none',
      isProduction: false,
    });
  });

  it('coerces PORT and reads overrides', () => {
    const c = loadConfig({ ...valid, PORT: '8080', LOG_LEVEL: 'debug', NODE_ENV: 'test' });
    expect(c.port).toBe(8080);
    expect(c.logLevel).toBe('debug');
    expect(c.env).toBe('test');
  });

  it('reads DB_POOL_SIZE and DB_ACQUIRE_TIMEOUT_MS overrides', () => {
    const c = loadConfig({ ...valid, DB_POOL_SIZE: '25', DB_ACQUIRE_TIMEOUT_MS: '1500' });
    expect(c.dbPoolSize).toBe(25);
    expect(c.dbAcquireTimeoutMs).toBe(1500);
  });

  it('lists every missing required variable by name', () => {
    const err = errorOf({});
    const names = err.issues.map((i) => i.variable);
    expect(names).toEqual(
      expect.arrayContaining(['APP_BASE_URL', 'CORS_ORIGINS', 'DATABASE_URL', 'REDIS_URL']),
    );
    expect(err.message).toContain('DATABASE_URL');
  });

  it('treats empty strings as missing', () => {
    const err = errorOf({ ...valid, DATABASE_URL: '' });
    expect(err.issues.map((i) => i.variable)).toContain('DATABASE_URL');
  });

  it('never puts variable values in the error message', () => {
    const err = errorOf({ ...valid, DATABASE_URL: 'postgres://user:secret-pass@h/db' });
    expect(err.message).toContain('DATABASE_URL');
    expect(err.message).not.toContain('secret-pass');
  });

  it.each([
    ['PORT', '0'],
    ['PORT', '70000'],
    ['PORT', 'abc'],
    ['DB_POOL_SIZE', '0'],
    ['DB_POOL_SIZE', '101'],
    ['DB_POOL_SIZE', 'many'],
    ['DB_ACQUIRE_TIMEOUT_MS', '99'],
    ['DB_ACQUIRE_TIMEOUT_MS', '60001'],
    ['DB_ACQUIRE_TIMEOUT_MS', 'soon'],
    ['LOG_LEVEL', 'verbose'],
    ['NODE_ENV', 'staging'],
    ['APP_BASE_URL', 'not a url'],
    ['APP_BASE_URL', 'ftp://example.com'],
    ['DATABASE_URL', 'http://localhost/db'],
    ['REDIS_URL', 'mysql://localhost'],
    ['NEWS_PROVIDER', 'bing'],
    ['VIDEO_SEARCH_PROVIDER', 'mock'],
  ])('rejects invalid %s=%s', (name, value) => {
    const err = errorOf({ ...valid, [name]: value });
    expect(err.issues.map((i) => i.variable)).toContain(name);
  });

  describe('CORS_ORIGINS', () => {
    it('trims, dedupes and parses a list', () => {
      const c = loadConfig({
        ...valid,
        CORS_ORIGINS: ' http://localhost:5173 ,https://app.example.com,http://localhost:5173',
      });
      expect(c.corsOrigins).toEqual(['http://localhost:5173', 'https://app.example.com']);
    });

    it.each(['*', 'http://localhost:5173/', 'http://a.com/path', 'localhost:5173', 'ftp://a.com'])(
      'rejects %s',
      (value) => {
        const err = errorOf({ ...valid, CORS_ORIGINS: value });
        expect(err.issues.map((i) => i.variable)).toContain('CORS_ORIGINS');
      },
    );

    it('rejects a list containing a wildcard entry', () => {
      const err = errorOf({ ...valid, CORS_ORIGINS: 'http://localhost:5173,*' });
      expect(err.issues.map((i) => i.variable)).toContain('CORS_ORIGINS');
    });

    it('rejects an empty list', () => {
      const err = errorOf({ ...valid, CORS_ORIGINS: ' , ' });
      expect(err.issues.map((i) => i.variable)).toContain('CORS_ORIGINS');
    });
  });

  describe('mock providers (TD-016)', () => {
    it.each(['NEWS_PROVIDER', 'AI_PROVIDER'])('rejects %s=mock in production', (name) => {
      const err = errorOf({ ...valid, NODE_ENV: 'production', [name]: 'mock' });
      expect(err.issues.map((i) => i.variable)).toContain(name);
      expect(err.message).toMatch(/mock/i);
      expect(err.message).toContain('production');
    });

    it.each(['development', 'test'])('accepts mock in %s', (nodeEnv) => {
      const c = loadConfig({
        ...valid,
        NODE_ENV: nodeEnv,
        NEWS_PROVIDER: 'mock',
        AI_PROVIDER: 'mock',
      });
      expect(c.newsProvider).toBe('mock');
      expect(c.aiProvider).toBe('mock');
    });

    it('accepts none in production', () => {
      const c = loadConfig({ ...valid, NODE_ENV: 'production' });
      expect(c.isProduction).toBe(true);
      expect(c.newsProvider).toBe('none');
    });
  });
});
