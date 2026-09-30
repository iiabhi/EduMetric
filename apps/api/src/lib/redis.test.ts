import { describe, expect, it, vi } from 'vitest';
import { LogCapture } from '../test-utils/log-capture.js';
import { testConfig } from '../test-utils/config.js';
import { createLogger } from './logger.js';
import { createRedisClient, createThrottledWarn } from './redis.js';

describe('createThrottledWarn (CACHE-009)', () => {
  it('logs at most once per interval', () => {
    vi.useFakeTimers();
    const warn = vi.fn();
    const log = createThrottledWarn({ warn } as never, 1000);
    log(new Error('a'), 'one');
    log(new Error('b'), 'two');
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    log(new Error('c'), 'three');
    expect(warn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('createRedisClient', () => {
  it('starts while Redis is unreachable and never logs the URL or its password', async () => {
    const out = new LogCapture();
    const logger = createLogger(testConfig({ LOG_LEVEL: 'info' }), out);
    // Port 1 refuses connections immediately.
    const client = createRedisClient({ redisUrl: 'redis://:pw-secret@127.0.0.1:1' }, logger, 'api');
    await vi.waitFor(() => {
      expect(out.lines.length).toBeGreaterThan(0);
    });
    client.disconnect();
    expect(out.raw).toContain('Redis error');
    expect(out.raw).not.toContain('pw-secret');
  });

  it('api role fails a command at once while Redis is down', async () => {
    const logger = createLogger(testConfig({ LOG_LEVEL: 'silent' }));
    const client = createRedisClient({ redisUrl: 'redis://127.0.0.1:1' }, logger, 'api');
    await expect(client.ping()).rejects.toThrow();
    client.disconnect();
  });
});
