import { fileURLToPath } from 'node:url';
import { config as loadDotenv, type DotenvPopulateInput } from 'dotenv';

/**
 * The repo-root .env. Resolved from this file's location (src/config or dist/config, both four
 * levels below the root), never from the working directory: npm runs workspace scripts in apps/api.
 */
export const ROOT_ENV_PATH = fileURLToPath(new URL('../../../../.env', import.meta.url));

/** ENV_FILE when set to a non-empty value, otherwise the repo-root .env. */
export const resolveEnvFilePath = (env: DotenvPopulateInput): string => {
  const override = env.ENV_FILE;
  return override !== undefined && override !== '' ? override : ROOT_ENV_PATH;
};

export interface LoadEnvOptions {
  /** Where variables are written. Defaults to the real process environment. */
  env?: DotenvPopulateInput;
  /** Overrides the file. Defaults to ENV_FILE when set, otherwise the repo-root .env. */
  path?: string;
}

/**
 * Fill in variables that are NOT already set from a .env file. This is the one place that reads
 * .env (API, worker, seed and the Prisma config all go through it).
 *
 * - A variable that is already set always wins, even if empty, so Docker, CI and production values
 *   are never overridden by a file.
 * - In production (NODE_ENV=production in the real environment) nothing is read, so a .env that ends
 *   up in an image or on a server can never supply configuration, and ENV_FILE is ignored.
 * - A missing file is ignored without a message; config validation reports anything still missing.
 * - `ENV_FILE` points at a different file. Pointing it at a file that does not exist loads nothing,
 *   which is how tests keep a developer's real .env out.
 */
export const loadEnvFile = ({ env = process.env, path }: LoadEnvOptions = {}): void => {
  if (env.NODE_ENV === 'production') return;
  loadDotenv({
    path: path ?? resolveEnvFilePath(env),
    processEnv: env,
    override: false,
    quiet: true,
  });
};
