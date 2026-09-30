import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// FIX-01: .env is read in ONE shared place (config/loadEnv.ts). No other source file may use dotenv.
const apiDir = fileURLToPath(new URL('../../', import.meta.url));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });

describe('single .env loader', () => {
  it('only config/loadEnv.ts imports dotenv', () => {
    const files = [...sourceFiles(join(apiDir, 'src')), join(apiDir, 'prisma.config.ts')];
    const users = files.filter((f) => readFileSync(f, 'utf8').includes('dotenv'));
    expect(users.map((f) => f.slice(apiDir.length))).toEqual(['src/config/loadEnv.ts']);
  });

  it('prisma.config.ts goes through loadEnvFile', () => {
    expect(readFileSync(join(apiDir, 'prisma.config.ts'), 'utf8')).toContain('loadEnvFile()');
  });
});
