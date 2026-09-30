import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from './app.js';
import { createLogger } from './lib/logger.js';
import { sendSuccess } from './lib/response.js';
import { validate } from './middleware/validate.js';
import { testConfig } from './test-utils/config.js';
import { LogCapture } from './test-utils/log-capture.js';

// Independent review tests for F-01: CONV-003 / CONV-009 on every error path.
const build = () => {
  const logs = new LogCapture();
  const config = testConfig({ LOG_LEVEL: 'info' });
  const app = createApp({
    config,
    logger: createLogger(config, logs),
    mountRoutes: (a: Express) => {
      a.get('/t/boom', () => {
        throw new Error('boom');
      });
      a.post('/t/v', validate({ body: z.object({ n: z.number() }) }), (req, res) => {
        sendSuccess(res, req.validated.body);
      });
    },
  });
  return { app, logs };
};

describe('every error response carries X-Request-Id matching error.requestId', () => {
  it.each([
    ['500', (a: Express) => request(a).get('/t/boom'), 500],
    ['404', (a: Express) => request(a).get('/missing'), 404],
    ['400 validation', (a: Express) => request(a).post('/t/v').send({ n: 'x' }), 400],
    [
      '400 malformed json',
      (a: Express) => request(a).post('/t/v').set('Content-Type', 'application/json').send('{"n":'),
      400,
    ],
    [
      '413',
      (a: Express) =>
        request(a)
          .post('/t/v')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ n: 1, pad: 'x'.repeat(101 * 1024) })),
      413,
    ],
  ] as const)('%s', async (_n, call, status) => {
    const { app } = build();
    const res = await call(app);
    expect(res.status).toBe(status);
    const b = res.body as { success: boolean; error: { requestId: string; code: string } };
    expect(b.success).toBe(false);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(b.error.requestId).toBe(res.headers['x-request-id']);
    expect(res.text).not.toMatch(/\bat .*\(.*:\d+:\d+\)/);
  });

  it('boundary: 100 KB-ish body under limit is not 413', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/t/v')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ n: 1, pad: 'x'.repeat(99 * 1024) }));
    expect(res.status).not.toBe(413);
  });
});

describe('logger never leaks credentials sent in a request', () => {
  it('does not log Authorization, Cookie or password body values', async () => {
    const { app, logs } = build();
    await request(app)
      .post('/t/v')
      .set('Authorization', 'Bearer leak-jwt-123')
      .set('Cookie', 'refresh=leak-cookie-456')
      .send({ n: 1, password: 'leak-pass-789' });
    expect(logs.raw).not.toContain('leak-jwt-123');
    expect(logs.raw).not.toContain('leak-cookie-456');
    expect(logs.raw).not.toContain('leak-pass-789');
  });
});
