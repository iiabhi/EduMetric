import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { parseHostPort, probeTcp } from './tcpProbe.js';

describe('parseHostPort', () => {
  it('uses the default port when the URL has none', () => {
    expect(parseHostPort('mysql://u:p@db.local/app', 3306)).toEqual({
      host: 'db.local',
      port: 3306,
    });
  });

  it('uses the explicit port', () => {
    expect(parseHostPort('redis://cache:6380', 6379)).toEqual({ host: 'cache', port: 6380 });
  });

  it('handles rediss and ignores credentials', () => {
    expect(parseHostPort('rediss://default:secret@redis.example.com', 6379)).toEqual({
      host: 'redis.example.com',
      port: 6379,
    });
  });

  it('strips brackets from IPv6 hosts', () => {
    expect(parseHostPort('redis://[::1]:6379', 6379)).toEqual({ host: '::1', port: 6379 });
  });
});

describe('probeTcp', () => {
  let server: net.Server | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  const listen = (): Promise<number> =>
    new Promise((resolve) => {
      server = net.createServer((socket) => {
        socket.on('error', () => undefined);
      });
      server.listen(0, '127.0.0.1', () => {
        resolve((server?.address() as net.AddressInfo).port);
      });
    });

  it('returns true when something is listening', async () => {
    const port = await listen();
    expect(await probeTcp('127.0.0.1', port, 1000)).toBe(true);
  });

  it('returns false when the port is closed', async () => {
    const port = await listen();
    server?.close();
    expect(await probeTcp('127.0.0.1', port, 1000)).toBe(false);
  });

  it('returns false for an unreachable address within the timeout', async () => {
    const started = Date.now();
    expect(await probeTcp('10.255.255.1', 9, 200)).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
