import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { testConfig } from '../../test-utils/config.js';
import { buildReadinessChecks } from './health.checks.js';

describe('buildReadinessChecks (real probes)', () => {
  let server: net.Server | undefined;
  afterEach(() => {
    server?.close();
    server = undefined;
  });

  const listen = (): Promise<number> =>
    new Promise((resolve) => {
      server = net.createServer((s) => {
        s.on('error', () => undefined);
      });
      server.listen(0, '127.0.0.1', () => {
        resolve((server?.address() as net.AddressInfo).port);
      });
    });

  it('passes when both configured ports accept connections', async () => {
    const port = await listen();
    const checks = buildReadinessChecks(
      testConfig({
        DATABASE_URL: `mysql://u:p@127.0.0.1:${port}/db`,
        REDIS_URL: `redis://127.0.0.1:${port}`,
      }),
    );
    expect(await Promise.all(checks.map((c) => c.check()))).toEqual([true, true]);
  });

  it('fails the check whose port is closed', async () => {
    const port = await listen();
    const closed = await listen();
    server?.close();
    const checks = buildReadinessChecks(
      testConfig({
        DATABASE_URL: `mysql://u:p@127.0.0.1:${closed}/db`,
        REDIS_URL: `redis://127.0.0.1:${port}`,
      }),
    );
    const results = await Promise.all(checks.map((c) => c.check()));
    expect(results[0]).toBe(false);
  });
});
