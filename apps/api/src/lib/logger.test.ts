import { describe, expect, it } from 'vitest';
import { LogCapture } from '../test-utils/log-capture.js';
import { testConfig } from '../test-utils/config.js';
import { createLogger } from './logger.js';

const make = () => {
  const out = new LogCapture();
  const logger = createLogger(testConfig({ LOG_LEVEL: 'info' }), out);
  return { out, logger };
};

describe('logger redaction (SEC-014)', () => {
  it('redacts authorization and cookie headers', () => {
    const { out, logger } = make();
    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer super-secret-jwt',
            cookie: 'refresh=super-secret-cookie',
            'user-agent': 'vitest',
          },
        },
        res: { headers: { 'set-cookie': ['refresh=set-secret'] } },
      },
      'request',
    );
    expect(out.raw).not.toContain('super-secret-jwt');
    expect(out.raw).not.toContain('super-secret-cookie');
    expect(out.raw).not.toContain('set-secret');
    expect(out.raw).toContain('[REDACTED]');
    expect(out.raw).toContain('vitest');
  });

  it.each([
    'password',
    'newPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'clientSecret',
  ])('redacts %s at top level and when nested', (field) => {
    const { out, logger } = make();
    logger.info(
      { [field]: 'leak-top', body: { [field]: 'leak-nested' }, a: { b: { [field]: 'leak-deep' } } },
      'x',
    );
    expect(out.raw).not.toContain('leak-top');
    expect(out.raw).not.toContain('leak-nested');
    expect(out.raw).not.toContain('leak-deep');
  });

  it('keeps ordinary fields and respects the log level', () => {
    const out = new LogCapture();
    const logger = createLogger(testConfig({ LOG_LEVEL: 'warn' }), out);
    logger.info({ note: 'hidden' }, 'below level');
    logger.warn({ note: 'visible' }, 'at level');
    expect(out.raw).not.toContain('hidden');
    expect(out.lines[0]).toMatchObject({ note: 'visible', msg: 'at level' });
  });

  it('serialises errors with their stack server-side', () => {
    const { out, logger } = make();
    logger.error({ err: new Error('kaboom') }, 'failed');
    const line = out.lines[0] as { err: { stack: string; message: string } };
    expect(line.err.message).toBe('kaboom');
    expect(line.err.stack).toContain('Error: kaboom');
  });
});
