import { describe, expect, it } from 'vitest';
import { testConfig } from '../test-utils/config.js';
import { allowsPublicKeyRetrieval, createPrismaClient } from './prisma.js';

describe('createPrismaClient', () => {
  it('does not connect until the first query, so the API can start while MySQL is down', async () => {
    const db = createPrismaClient(
      testConfig({ DATABASE_URL: 'mysql://app:pw@127.0.0.1:1/edumetrics' }),
    );
    await expect(db.$disconnect()).resolves.toBeUndefined();
  });

  it('rejects a URL that is not mysql:// without echoing it', () => {
    expect(() =>
      createPrismaClient({
        ...testConfig(),
        databaseUrl: 'postgres://u:topsecret@h/db',
      }),
    ).toThrow(/mysql:\/\//);
    try {
      createPrismaClient({
        ...testConfig(),
        databaseUrl: 'postgres://u:topsecret@h/db',
      });
    } catch (error) {
      expect((error as Error).message).not.toContain('topsecret');
    }
  });
});

describe('allowsPublicKeyRetrieval (no-TLS MySQL 8 login)', () => {
  it.each(['development', 'test'])('is on for %s', (env) => {
    expect(allowsPublicKeyRetrieval(env)).toBe(true);
  });

  it.each(['production', 'staging', ''])('is off for %j', (env) => {
    expect(allowsPublicKeyRetrieval(env)).toBe(false);
  });
});
