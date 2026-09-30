import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestPrisma } from '../test-utils/db.js';
import { withTransaction } from './transaction.js';

const prisma = createTestPrisma();

beforeEach(async () => {
  await clearDatabase(prisma);
});

afterAll(async () => {
  await clearDatabase(prisma);
  await prisma.$disconnect();
});

describe('withTransaction (DB-006)', () => {
  it('commits both writes together', async () => {
    await withTransaction(prisma, async (tx) => {
      const user = await tx.user.create({ data: { email: 'a@example.com' } });
      await tx.studentProfile.create({ data: { userId: user.id, fullName: 'A' } });
    });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.studentProfile.count()).toBe(1);
  });

  it('rolls back the first write when the second fails', async () => {
    await expect(
      withTransaction(prisma, async (tx) => {
        await tx.user.create({ data: { email: 'a@example.com' } });
        throw new Error('second step failed');
      }),
    ).rejects.toThrow('second step failed');
    expect(await prisma.user.count()).toBe(0);
  });

  it('rolls back when a later write violates a constraint', async () => {
    await expect(
      withTransaction(prisma, async (tx) => {
        await tx.user.create({ data: { email: 'a@example.com' } });
        await tx.user.create({ data: { email: 'a@example.com' } });
      }),
    ).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });
});
