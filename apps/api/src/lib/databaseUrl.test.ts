import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from './databaseUrl.js';

describe('parseDatabaseUrl', () => {
  it('parses host, port, credentials and database', () => {
    expect(parseDatabaseUrl('mysql://app:secret@db.internal:3307/edumetrics')).toEqual({
      host: 'db.internal',
      port: 3307,
      user: 'app',
      password: 'secret',
      database: 'edumetrics',
    });
  });

  it('defaults the port to 3306', () => {
    expect(parseDatabaseUrl('mysql://app:secret@localhost/edumetrics').port).toBe(3306);
  });

  it('decodes percent-encoded credentials', () => {
    const parsed = parseDatabaseUrl('mysql://app%40x:p%40ss%3Aw%2Frd@localhost/edumetrics');
    expect(parsed.user).toBe('app@x');
    expect(parsed.password).toBe('p@ss:w/rd');
  });

  it('allows an empty password (compose test profile)', () => {
    expect(parseDatabaseUrl('mysql://root@127.0.0.1:3307/edumetrics_test').password).toBe('');
  });

  it.each([
    ['another scheme', 'postgres://u:secret-pass@h/db'],
    ['not a URL', 'secret-pass'],
    ['no database', 'mysql://u:secret-pass@h'],
  ])('rejects %s without leaking the password', (_name, value) => {
    let message = '';
    try {
      parseDatabaseUrl(value);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain('secret-pass');
  });
});
