import { describe, expect, it } from 'vitest';
import { createReadinessService } from './health.service.js';

const up = { name: 'up', check: () => Promise.resolve(true) };
const down = { name: 'down', check: () => Promise.resolve(false) };

describe('createReadinessService', () => {
  it('is ready when there are no checks', async () => {
    expect(await createReadinessService([]).run()).toEqual({ ready: true, failed: [] });
  });

  it('is ready when every check passes', async () => {
    expect(await createReadinessService([up, up]).run()).toEqual({ ready: true, failed: [] });
  });

  it('reports the name of a failed check', async () => {
    expect(await createReadinessService([up, down]).run()).toEqual({
      ready: false,
      failed: ['down'],
    });
  });

  it('treats a rejecting check as failed', async () => {
    const boom = { name: 'boom', check: () => Promise.reject(new Error('x')) };
    expect(await createReadinessService([boom]).run()).toEqual({ ready: false, failed: ['boom'] });
  });

  it('treats a hanging check as failed after the timeout', async () => {
    const hang = { name: 'hang', check: () => new Promise<boolean>(() => undefined) };
    const started = Date.now();
    expect(await createReadinessService([hang, up], 50).run()).toEqual({
      ready: false,
      failed: ['hang'],
    });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
