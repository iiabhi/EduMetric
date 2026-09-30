import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { sendSuccess } from './response.js';
import { createLogger } from './logger.js';
import { testConfig } from '../test-utils/config.js';
import { createTestPrisma } from '../test-utils/db.js';
import { LogCapture } from '../test-utils/log-capture.js';
import { createPrismaClient } from './prisma.js';

// Built at run time: in development Prisma echoes the calling source lines in its errors, so a
// literal password in this file would show up in that output.
const secret = ['Super', 'Secret', 'Pw9'].join('');
const unreachableUrl = `mysql://root:${secret}@127.0.0.1:1/edumetrics_test`;

// Fails fast: nothing listens on port 1, and a query waits at most 500 ms for a connection.
const unreachableClient = (env: string) =>
  createPrismaClient({
    ...testConfig({ NODE_ENV: env }),
    databaseUrl: unreachableUrl,
    dbAcquireTimeoutMs: 500,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Prisma client lifecycle', () => {
  it('connects, runs a query and disconnects; a second disconnect is safe', async () => {
    const prisma = createTestPrisma();
    const rows = await prisma.$queryRaw<{ one: bigint | number }[]>`SELECT 1 AS one`;
    expect(Number(rows[0]?.one)).toBe(1);
    await prisma.$disconnect();
    await expect(prisma.$disconnect()).resolves.toBeUndefined();
  });
});

describe('a failed database connection never leaks the password (SEC-005, SEC-014)', () => {
  it('keeps it out of the thrown error and everything Prisma prints', async () => {
    const printed: string[] = [];
    // Prisma prints through console.*; also catch anything written to the raw streams.
    const record = (...args: unknown[]): void => {
      printed.push(args.map(String).join(' '));
    };
    for (const method of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation(record);
    }
    const capture = (chunk: string | Uint8Array): boolean => {
      printed.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stderr, 'write').mockImplementation(capture);
    vi.spyOn(process.stdout, 'write').mockImplementation(capture);

    const prisma = unreachableClient('test');
    const error = await prisma.user.count().then(
      () => undefined,
      (e: unknown) => e,
    );
    await prisma.$disconnect();
    vi.restoreAllMocks();

    expect(error).toBeDefined();
    const message = (error as Error).message;
    expect(message).not.toContain(secret);
    expect(String((error as Error).stack)).not.toContain(secret);
    expect(printed.join('')).not.toContain(secret);
    // Prisma did report the failure, so the empty-looking output above is meaningful.
    expect(printed.join('')).toContain('prisma:error');
    // errorFormat 'minimal' outside development: no echoed source frame from this file.
    expect(message).not.toContain('prisma.int.test.ts');
  });

  it('keeps it out of our logger and the API error response', async () => {
    const logs = new LogCapture();
    const config = testConfig({ LOG_LEVEL: 'debug' });
    const prisma = unreachableClient('test');
    const app = createApp({
      config,
      logger: createLogger(config, logs),
      mountRoutes: (a) => {
        a.get('/t/db', async (_req, res) => {
          sendSuccess(res, { users: await prisma.user.count() });
        });
      },
    });

    const res = await request(app).get('/t/db');
    await prisma.$disconnect();

    expect(res.status).toBe(500);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain(secret);
    expect(JSON.stringify(res.headers)).not.toContain(secret);
    // The failure is logged (so it is diagnosable) without the credentials.
    expect(logs.lines.some((line) => line.level === 50)).toBe(true); // pino error level
    // The Prisma error text itself was logged, so not finding the password is meaningful.
    expect(logs.raw).toContain('pool failed to retrieve a connection');
    expect(logs.raw).not.toContain(secret);
  });

  it('keeps the detailed error format in development only', async () => {
    const development = unreachableClient('development');
    const error = await development.user.count().then(
      () => undefined,
      (e: unknown) => e,
    );
    await development.$disconnect();
    // Development keeps Prisma's detailed format, which names the calling file.
    expect((error as Error).message).toContain('prisma.int.test.ts');
    expect((error as Error).message).not.toContain(secret);
  });
});
