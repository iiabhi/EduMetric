import { paginationQuerySchema } from '@edumetrics/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from './app.js';
import { ConflictError, RateLimitedError } from './lib/errors.js';
import { createLogger } from './lib/logger.js';
import { validate } from './middleware/validate.js';
import { sendSuccess } from './lib/response.js';
import { testConfig } from './test-utils/config.js';
import { LogCapture } from './test-utils/log-capture.js';

const ORIGIN = 'http://localhost:5173';

interface TestBody {
  success?: boolean;
  data?: unknown;
  error: {
    code: string;
    message: string;
    requestId: string;
    details: { path: string; message: string }[];
  };
  openapi: string;
  paths: Record<string, { get?: unknown }>;
  components: { schemas: Record<string, unknown> };
}

const body = (res: { body: unknown }) => res.body as TestBody;

const build = (overrides: Record<string, string> = {}) => {
  const logs = new LogCapture();
  const config = testConfig({ LOG_LEVEL: 'info', ...overrides });
  const app = createApp({
    config,
    logger: createLogger(config, logs),
    mountRoutes: (a: Express, api) => {
      api.get('/test/ping', (_req, res) => {
        sendSuccess(res, { pong: true });
      });
      a.get('/test/boom', () => {
        throw new Error('boom secret-detail');
      });
      a.get('/test/conflict', () => {
        throw new ConflictError();
      });
      a.get('/test/rate', () => {
        throw new RateLimitedError(30);
      });
      a.get('/test/items/:id', (_req, res) => {
        sendSuccess(res, { ok: true });
      });
      a.post(
        '/test/validate',
        validate({ body: z.object({ email: z.email().max(254), name: z.string().max(10) }) }),
        (req, res) => {
          sendSuccess(res, req.validated.body);
        },
      );
      a.get('/test/page', validate({ query: paginationQuerySchema }), (req, res) => {
        sendSuccess(res, req.validated.query);
      });
      a.post('/test/echo', (req, res) => {
        sendSuccess(res, { received: JSON.stringify(req.body).length });
      });
    },
  });
  return { app, logs };
};

describe('GET /healthz', () => {
  it('returns 200 in the success envelope with X-Request-Id', async () => {
    const { app } = build();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(body(res)).toEqual({ success: true, data: { status: 'ok' } });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('API base path (CONV-001)', () => {
  it('serves routers added to `api` under /api/v1 only', async () => {
    const { app } = build();
    const ok = await request(app).get('/api/v1/test/ping');
    expect(ok.status).toBe(200);
    expect(body(ok).data).toEqual({ pong: true });
    expect((await request(app).get('/test/ping')).status).toBe(404);
  });
});

describe('unknown routes (acceptance)', () => {
  it.each([
    ['get', '/nope'],
    ['post', '/nope'],
    ['get', '/api/v1/unknown/thing'],
  ] as const)('%s %s returns 404 RESOURCE_NOT_FOUND with requestId', async (method, path) => {
    const { app } = build();
    const agent = request(app);
    const res = await (method === 'get' ? agent.get(path) : agent.post(path));
    expect(res.status).toBe(404);
    expect(body(res)).toEqual({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
        requestId: res.headers['x-request-id'],
      },
    });
  });
});

describe('unexpected errors (acceptance)', () => {
  it('returns 500 INTERNAL_ERROR with no stack or internals, and logs the stack', async () => {
    const { app, logs } = build();
    const res = await request(app).get('/test/boom');
    expect(res.status).toBe(500);
    expect(body(res).error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: res.headers['x-request-id'],
    });
    expect(res.text).not.toContain('boom');
    expect(res.text).not.toContain('secret-detail');
    expect(res.text).not.toContain('stack');
    expect(res.text).not.toContain('.ts:');

    const errorLine = logs.lines.find((l) => l.msg === 'Unhandled error') as {
      requestId: string;
      err: { stack: string; message: string };
    };
    expect(errorLine.requestId).toBe(res.headers['x-request-id']);
    expect(errorLine.err.message).toBe('boom secret-detail');
    expect(errorLine.err.stack).toContain('Error: boom secret-detail');
  });

  it('maps AppErrors and sets Retry-After', async () => {
    const { app } = build();
    const conflict = await request(app).get('/test/conflict');
    expect(conflict.status).toBe(409);
    expect(body(conflict).error.code).toBe('CONFLICT');

    const rate = await request(app).get('/test/rate');
    expect(rate.status).toBe(429);
    expect(rate.headers['retry-after']).toBe('30');
  });
});

describe('request id (CONV-009)', () => {
  it('propagates a valid incoming id, including on errors', async () => {
    const { app } = build();
    const res = await request(app).get('/nope').set('X-Request-Id', 'client-req-0001');
    expect(res.headers['x-request-id']).toBe('client-req-0001');
    expect(body(res).error.requestId).toBe('client-req-0001');
  });

  it('replaces an invalid incoming id', async () => {
    const { app } = build();
    const res = await request(app).get('/healthz').set('X-Request-Id', 'bad id with spaces');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is present on CORS preflight responses', async () => {
    const { app } = build();
    const res = await request(app)
      .options('/healthz')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('validation (CONV-007)', () => {
  it('accepts valid bodies', async () => {
    const { app } = build();
    const res = await request(app).post('/test/validate').send({ email: 'a@b.co', name: 'Ann' });
    expect(res.status).toBe(200);
    expect(body(res).data).toEqual({ email: 'a@b.co', name: 'Ann' });
  });

  it('returns VALIDATION_ERROR with details for bad fields', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/test/validate')
      .send({ email: 'nope', name: 'x'.repeat(11) });
    expect(res.status).toBe(400);
    expect(body(res).error.code).toBe('VALIDATION_ERROR');
    expect(
      body(res)
        .error.details.map((d: { path: string }) => d.path)
        .sort(),
    ).toEqual(['email', 'name']);
  });

  it('rejects unknown body fields', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/test/validate')
      .send({ email: 'a@b.co', name: 'Ann', isAdmin: true });
    expect(res.status).toBe(400);
    expect(body(res).error.code).toBe('VALIDATION_ERROR');
  });

  it('applies defaults and limits to query params', async () => {
    const { app } = build();
    const ok = await request(app).get('/test/page');
    expect(body(ok).data).toEqual({ limit: 20 });
    const bad = await request(app).get('/test/page?limit=101');
    expect(bad.status).toBe(400);
    const unknown = await request(app).get('/test/page?page=2');
    expect(unknown.status).toBe(400);
  });
});

describe('body size and parsing (API-006, CONV-008)', () => {
  it('accepts a body just under 100 KB', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/test/echo')
      .send({ pad: 'a'.repeat(99_000) });
    expect(res.status).toBe(200);
  });

  it('rejects a body over 100 KB with 413 PAYLOAD_TOO_LARGE', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/test/echo')
      .send({ pad: 'a'.repeat(110_000) });
    expect(res.status).toBe(413);
    expect(body(res).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 400 for malformed JSON without parser internals', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/test/echo')
      .set('Content-Type', 'application/json')
      .send('{"a": ');
    expect(res.status).toBe(400);
    expect(body(res).error.code).toBe('VALIDATION_ERROR');
    expect(res.text).not.toMatch(/Unexpected|JSON at position|SyntaxError/);
  });

  it('does not parse url-encoded bodies', async () => {
    const { app } = build();
    const res = await request(app)
      .post('/test/validate')
      .type('form')
      .send('email=a@b.co&name=Ann');
    expect(res.status).toBe(400);
  });
});

describe('CORS (SEC-012)', () => {
  it('echoes an allow-listed origin with credentials', async () => {
    const { app } = build();
    const res = await request(app).get('/healthz').set('Origin', ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toContain('Origin');
  });

  it('gives no CORS headers to other origins', async () => {
    const { app } = build();
    const res = await request(app).get('/healthz').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('never answers with a wildcard', async () => {
    const { app } = build();
    for (const origin of [ORIGIN, 'https://evil.example', 'null']) {
      const res = await request(app).get('/healthz').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    }
  });

  it('answers preflight for an allowed origin', async () => {
    const { app } = build();
    const res = await request(app)
      .options('/test/validate')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('does not allow preflight for other origins', async () => {
    const { app } = build();
    const res = await request(app)
      .options('/test/validate')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('supports several configured origins', async () => {
    const { app } = build({ CORS_ORIGINS: `${ORIGIN},https://app.example.com` });
    const res = await request(app).get('/healthz').set('Origin', 'https://app.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });
});

describe('security headers (SEC-017, SEC-013)', () => {
  it('sets helmet headers and hides X-Powered-By', async () => {
    const { app } = build();
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('enables HSTS in production and keeps helmet headers on errors', async () => {
    const { app } = build({ NODE_ENV: 'production' });
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('OpenAPI docs (TD-005)', () => {
  it.each(['development', 'test'])('serves the spec in %s and lists /healthz', async (nodeEnv) => {
    const { app } = build({ NODE_ENV: nodeEnv });
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(body(res).openapi).toMatch(/^3\./);
    expect(body(res).paths['/healthz']?.get).toBeDefined();
    expect(body(res).components.schemas.ErrorEnvelope).toBeDefined();
  });

  it('is not mounted in production', async () => {
    const { app } = build({ NODE_ENV: 'production' });
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(404);
    expect(body(res).error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('request logging (SEC-014, SRD 21)', () => {
  it('logs one line per request with route template and no secrets', async () => {
    const { app, logs } = build();
    await request(app)
      .post('/test/echo?token=query-secret')
      .set('Authorization', 'Bearer super-secret-jwt')
      .set('Cookie', 'refresh=super-secret-cookie')
      .send({ password: 'pw-secret-123', email: 'student@example.com' });

    expect(logs.raw).not.toContain('super-secret-jwt');
    expect(logs.raw).not.toContain('super-secret-cookie');
    expect(logs.raw).not.toContain('pw-secret-123');
    expect(logs.raw).not.toContain('query-secret');
    expect(logs.raw).not.toContain('student@example.com');

    const line = logs.lines.find((l) => l.msg === 'request completed') ?? {};
    expect(line).toMatchObject({
      requestId: expect.any(String) as string,
      route: '/test/echo',
      req: { method: 'POST' },
      res: { statusCode: 200 },
    });
    expect(typeof line.responseTime).toBe('number');
  });

  it('uses the route template instead of the raw URL with ids', async () => {
    const { app, logs } = build();
    await request(app).get('/test/items/4f2a9c1e-0000-4000-8000-000000000000');
    expect(logs.raw).not.toContain('4f2a9c1e');
    expect(logs.lines.find((l) => l.route === '/test/items/:id')).toBeDefined();
  });

  it('labels unmatched routes', async () => {
    const { app, logs } = build();
    await request(app).get('/some/secret/path-123');
    expect(logs.raw).not.toContain('path-123');
    expect(logs.lines.find((l) => l.route === 'unmatched')).toBeDefined();
  });
});
