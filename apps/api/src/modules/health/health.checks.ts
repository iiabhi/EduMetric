import type { RedisClient } from '../../lib/redis.js';
import type { HealthRepository } from './health.repository.js';
import type { ReadinessCheck } from './health.service.js';

export interface ReadinessDeps {
  health: Pick<HealthRepository, 'ping'>;
  redis: Pick<RedisClient, 'ping'>;
}

/**
 * MySQL answers `SELECT 1` and Redis answers `PING` (ADR 0009, replaces the TCP probe of ADR 0005).
 * Prisma's pool and ioredis reconnect by themselves, so nothing restarts after a dependency restarts.
 * The readiness service supplies the timeout.
 */
export const buildReadinessChecks = ({ health, redis }: ReadinessDeps): ReadinessCheck[] => [
  {
    name: 'mysql',
    check: async () => {
      await health.ping();
      return true;
    },
  },
  {
    name: 'redis',
    check: async () => {
      const reply: string = await redis.ping();
      return reply === 'PONG';
    },
  },
];
