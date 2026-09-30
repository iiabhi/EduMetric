import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createLogger } from '../../lib/logger.js';
import { testConfig } from '../../test-utils/config.js';
import { LogCapture } from '../../test-utils/log-capture.js';
import { buildReadinessChecks } from './health.checks.js';
import type { ReadinessCheck } from './health.service.js';

const build = (checks?: ReadinessCheck[]) => {
  const logs = new LogCapture();
  const config = testConfig({ LOG_LEVEL: 'info' });
  const app = createApp({
    config,
    logger: createLogger(config, logs),
    ...(checks === undefined ? {} : { readinessChecks: checks }),
  });
  return { app, logs };
};

const check = (name: string, ok: boolean): ReadinessCheck => ({
  name,
  check: () => Promise.resolve(ok),
});

describe('GET /readyz', () => {
  it('returns 200 when all dependencies are reachable', async () => {
    const { app } = build([check('mysql', true), check('redis', true)]);
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ready' } });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns 503 in the error envelope when a dependency is down', async () => {
    const { app } = build([check('mysql', false), check('redis', true)]);
    const res = await request(app).get('/readyz');
    const body = res.body as { success: boolean; error: Record<string, unknown> };
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
    expect(body.error.details).toBeUndefined();
  });

  it('does not reveal which dependency failed or any internals in the body', async () => {
    const { app } = build([check('mysql', false)]);
    const res = await request(app).get('/readyz');
    expect(res.text).not.toMatch(/mysql|redis|stack|localhost|3306/i);
  });

  it('logs the failed dependency names server-side', async () => {
    const { app, logs } = build([check('mysql', false), check('redis', false)]);
    const res = await request(app).get('/readyz');
    const line = logs.lines.find((l) => l.msg === 'Readiness check failed');
    expect(line).toMatchObject({
      failed: ['mysql', 'redis'],
      requestId: res.headers['x-request-id'],
    });
  });

  it('is ready by default when no checks are configured', async () => {
    const { app } = build();
    expect((await request(app).get('/readyz')).status).toBe(200);
  });

  it('keeps /healthz liveness-only even when a dependency is down', async () => {
    const { app } = build([check('mysql', false)]);
    expect((await request(app).get('/healthz')).status).toBe(200);
  });

  it('is listed in the OpenAPI document', async () => {
    const { app } = build();
    const res = await request(app).get('/api/docs');
    expect((res.body as { paths: Record<string, unknown> }).paths['/readyz']).toBeDefined();
  });
});

describe('buildReadinessChecks', () => {
  it('builds mysql and redis checks from the config URLs', () => {
    const checks = buildReadinessChecks(testConfig());
    expect(checks.map((c) => c.name)).toEqual(['mysql', 'redis']);
  });
});
