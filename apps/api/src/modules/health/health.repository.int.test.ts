import { afterAll, describe, expect, it } from 'vitest';
import { createTestPrisma } from '../../test-utils/db.js';
import { createHealthRepository } from './health.repository.js';

describe('health repository (real MySQL)', () => {
  const prisma = createTestPrisma();
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('ping succeeds against the test database', async () => {
    await expect(createHealthRepository(prisma).ping()).resolves.toBeUndefined();
  });
});
