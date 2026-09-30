import { ConfigError, loadConfig, type Config } from './env.js';

/** Load config or print a clear message (variable names only) and exit 1. */
export const loadConfigOrExit = (env: Record<string, string | undefined> = process.env): Config => {
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
