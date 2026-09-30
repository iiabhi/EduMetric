import type { Config } from '../../config/env.js';
import { parseHostPort, probeTcp } from '../../lib/tcpProbe.js';
import type { ReadinessCheck } from './health.service.js';

const PROBE_TIMEOUT_MS = 1000;
const MYSQL_DEFAULT_PORT = 3306;
const REDIS_DEFAULT_PORT = 6379;

/**
 * MySQL and Redis reachability (ADR 0005). A fresh TCP connection per call, so a restarted
 * dependency is picked up with no reconnect logic. F-03/F-04 can swap in SELECT 1 / PING.
 */
export const buildReadinessChecks = (config: Config): ReadinessCheck[] => {
  const mysql = parseHostPort(config.databaseUrl, MYSQL_DEFAULT_PORT);
  const redis = parseHostPort(config.redisUrl, REDIS_DEFAULT_PORT);
  return [
    { name: 'mysql', check: () => probeTcp(mysql.host, mysql.port, PROBE_TIMEOUT_MS) },
    { name: 'redis', check: () => probeTcp(redis.host, redis.port, PROBE_TIMEOUT_MS) },
  ];
};
