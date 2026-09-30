import { z } from 'zod';

const NODE_ENVS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Config {
  env: NodeEnv;
  isProduction: boolean;
  port: number;
  logLevel: (typeof LOG_LEVELS)[number];
  appBaseUrl: string;
  corsOrigins: string[];
  databaseUrl: string;
  redisUrl: string;
  newsProvider: 'none' | 'mock';
  aiProvider: 'none' | 'mock';
  videoSearchProvider: 'none';
}

export interface ConfigIssue {
  variable: string;
  message: string;
}

/** Thrown when the environment is invalid. The message names variables, never values. */
export class ConfigError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i.variable}: ${i.message}`).join('\n')}`,
    );
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

const hasProtocol = (value: string, protocols: string[]): boolean => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const urlWithProtocol = (protocols: string[], label: string) =>
  z.string({ error: 'is required' }).refine((v) => hasProtocol(v, protocols), {
    error: `must be a valid ${label} URL`,
  });

/** An origin is scheme + host + optional port: no path, no trailing slash, no wildcard. */
const isOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
};

const corsOriginsSchema = z
  .string({ error: 'is required' })
  .transform((raw) => [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ])
  .refine((list) => list.length > 0, { error: 'must list at least one origin' })
  .refine((list) => list.every(isOrigin), {
    error:
      'must be a comma-separated list of http(s) origins (no wildcard, path or trailing slash)',
  });

const envSchema = z.object({
  NODE_ENV: z
    .enum(NODE_ENVS, { error: `must be one of ${NODE_ENVS.join(', ')}` })
    .default('development'),
  PORT: z.coerce
    .number({ error: 'must be an integer between 1 and 65535' })
    .int({ error: 'must be an integer between 1 and 65535' })
    .min(1, { error: 'must be an integer between 1 and 65535' })
    .max(65535, { error: 'must be an integer between 1 and 65535' })
    .default(3000),
  LOG_LEVEL: z
    .enum(LOG_LEVELS, { error: `must be one of ${LOG_LEVELS.join(', ')}` })
    .default('info'),
  APP_BASE_URL: urlWithProtocol(['http:', 'https:'], 'http(s)'),
  CORS_ORIGINS: corsOriginsSchema,
  DATABASE_URL: urlWithProtocol(['mysql:'], 'mysql://'),
  REDIS_URL: urlWithProtocol(['redis:', 'rediss:'], 'redis:// or rediss://'),
  NEWS_PROVIDER: z.enum(['none', 'mock'], { error: 'must be one of none, mock' }).default('none'),
  AI_PROVIDER: z.enum(['none', 'mock'], { error: 'must be one of none, mock' }).default('none'),
  VIDEO_SEARCH_PROVIDER: z.enum(['none'], { error: 'must be none' }).default('none'),
});

/**
 * Validate the environment and return typed config (SRD 22.1). Empty strings count as unset.
 * Mock providers are rejected when NODE_ENV=production (TD-016).
 */
export const loadConfig = (env: Record<string, string | undefined>): Config => {
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = envSchema.safeParse(cleaned);

  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? 'env'),
        message: issue.message,
      })),
    );
  }

  const v = parsed.data;

  if (v.NODE_ENV === 'production') {
    const offenders = [
      v.NEWS_PROVIDER === 'mock' ? 'NEWS_PROVIDER' : undefined,
      v.AI_PROVIDER === 'mock' ? 'AI_PROVIDER' : undefined,
    ].filter((name) => name !== undefined);
    if (offenders.length > 0) {
      throw new ConfigError(
        offenders.map((variable) => ({
          variable,
          message: 'the mock provider is not allowed when NODE_ENV=production',
        })),
      );
    }
  }

  return {
    env: v.NODE_ENV,
    isProduction: v.NODE_ENV === 'production',
    port: v.PORT,
    logLevel: v.LOG_LEVEL,
    appBaseUrl: v.APP_BASE_URL,
    corsOrigins: v.CORS_ORIGINS,
    databaseUrl: v.DATABASE_URL,
    redisUrl: v.REDIS_URL,
    newsProvider: v.NEWS_PROVIDER,
    aiProvider: v.AI_PROVIDER,
    videoSearchProvider: v.VIDEO_SEARCH_PROVIDER,
  };
};
