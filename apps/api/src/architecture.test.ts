import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Layering rules from SRD 7.2 and the raw-SQL rules from DB-007 / SEC-010.
const srcDir = fileURLToPath(new URL('./', import.meta.url));

// Every source file under src/ (generated code excluded), as paths relative to src/.
const sourceFiles = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .map((path) => path.replaceAll('\\', '/'))
  .filter((path) => path.endsWith('.ts') && !path.startsWith('generated/'));

const isTest = (path: string) => /\.(int\.)?test\.ts$/.test(path);

// Only these may import the Prisma client (or its generated code).
const mayUsePrisma = (path: string) =>
  path.endsWith('.repository.ts') ||
  path === 'lib/prisma.ts' ||
  path === 'lib/transaction.ts' ||
  path.startsWith('db/') ||
  path.startsWith('test-utils/') ||
  isTest(path);

const read = (path: string): string => readFileSync(`${srcDir}${path}`, 'utf8');

describe('layering (SRD 7.2)', () => {
  it('finds the source files it is meant to check', () => {
    expect(sourceFiles).toContain('app.ts');
    expect(sourceFiles).toContain('modules/profile/profile.repository.ts');
  });

  it('only repositories, lib/prisma, lib/transaction, db/ and tests import Prisma', () => {
    const offenders = sourceFiles
      .filter((path) => !mayUsePrisma(path))
      .filter((path) => /generated\/prisma|@prisma\//.test(read(path)));
    expect(offenders).toEqual([]);
  });

  it('controllers, services and routes never call the Prisma client directly', () => {
    const offenders = sourceFiles
      .filter((path) => /\.(controller|service|routes)\.ts$/.test(path) && !isTest(path))
      .filter((path) => /\$queryRaw|\$executeRaw|\$transaction|PrismaClient/.test(read(path)));
    expect(offenders).toEqual([]);
  });
});

describe('raw SQL (DB-007, SEC-010)', () => {
  const self = 'architecture.test.ts'; // mentions the banned names, so it is skipped below

  it('never uses the unsafe raw query methods', () => {
    const offenders = sourceFiles.filter(
      (path) => path !== self && /\$(query|execute)RawUnsafe/.test(read(path)),
    );
    expect(offenders).toEqual([]);
  });

  it('only calls $queryRaw / $executeRaw as tagged templates', () => {
    const offenders = sourceFiles.filter(
      (path) => path !== self && /\$(queryRaw|executeRaw)\s*\(/.test(read(path)),
    );
    expect(offenders).toEqual([]);
  });
});
