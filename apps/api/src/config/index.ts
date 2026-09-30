import { ConfigError, loadConfig, type Config } from './env.js';
import { loadEnvFile } from './loadEnv.js';

/**
 * Load config or print a clear message (variable names only) and exit 1. The real process
 * environment is first topped up from the env file (see loadEnvFile), so every entrypoint that calls
 * this (server, worker, seed) picks up the repo-root .env from any working directory. An explicit
 * `env` object is used exactly as given.
 */
export const loadConfigOrExit = (env: Record<string, string | undefined> = process.env): Config => {
  if (env === process.env) loadEnvFile();
  try {
    return loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
};

export { ConfigError, loadConfig, type Config } from './env.js';
export { loadEnvFile, ROOT_ENV_PATH } from './loadEnv.js';
