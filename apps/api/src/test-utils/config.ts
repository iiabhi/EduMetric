import { loadConfig, type Config } from '../config/env.js';

export const testConfig = (overrides: Record<string, string> = {}): Config =>
  loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    APP_BASE_URL: 'http://localhost:5173',
    CORS_ORIGINS: 'http://localhost:5173',
    DATABASE_URL: 'mysql://user:pass@localhost:3306/edumetrics_test',
    REDIS_URL: 'redis://localhost:6379',
    ...overrides,
  });
