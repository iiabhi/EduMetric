import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../../lib/transaction.js';
import { clearDatabase, createTestPrisma } from '../../test-utils/db.js';
import { createProfileRepository } from './profile.repository.js';

const prisma = createTestPrisma();
const repository = createProfileRepository(prisma);

const createStudent = async (email: string, fullName: string) => {
  const user = await prisma.user.create({ data: { email } });
  await prisma.studentProfile.create({
    data: { userId: user.id, fullName, universityName: 'IIT Test', officialCgpa: '9.10' },
  });
  return user.id;
};

beforeEach(async () => {
  await clearDatabase(prisma);
});

afterAll(async () => {
  await clearDatabase(prisma);
  await prisma.$disconnect();
});

describe('profile repository ownership (DB-001, SEC-008, SEC-022)', () => {
  it("returns the caller's own profile", async () => {
    const a = await createStudent('a@example.com', 'Student A');
    const profile = await repository.findByUserId(a);
    expect(profile?.userId).toBe(a);
    expect(profile?.fullName).toBe('Student A');
  });

  it("never returns another user's profile", async () => {
    const a = await createStudent('a@example.com', 'Student A');
    const b = await prisma.user.create({ data: { email: 'b@example.com' } }); // no profile yet
    expect(await repository.findByUserId(b.id)).toBeNull();
    expect(await repository.findByUserId(a)).not.toBeNull();
  });

  it('returns null for an unknown user id', async () => {
    expect(await repository.findByUserId('0'.repeat(36))).toBeNull();
  });

  it('selects only the listed columns', async () => {
    const a = await createStudent('a@example.com', 'Student A');
    const profile = await repository.findByUserId(a);
    expect(Object.keys(profile ?? {}).sort()).toEqual(
      [
        'admissionYear',
        'branch',
        'currentSemester',
        'degree',
        'fullName',
        'graduationYear',
        'gradingScaleMax',
        'officialCgpa',
        'onboardingCompletedAt',
        'studentIdentifier',
        'totalRequiredCredits',
        'universityName',
        'userId',
      ].sort(),
    );
    expect(profile).not.toHaveProperty('createdAt');
  });

  it("an update scoped to another user's id changes nothing", async () => {
    const a = await createStudent('a@example.com', 'Student A');
    const b = await createStudent('b@example.com', 'Student B');
    expect(await repository.updateByUserId(b, { fullName: 'B renamed' })).toBe(true);
    const untouched = await repository.findByUserId(a);
    expect(untouched?.fullName).toBe('Student A');
    expect((await repository.findByUserId(b))?.fullName).toBe('B renamed');
  });

  it('ignores userId, timestamps and onboarding state in an update (cannot re-assign a profile)', async () => {
    const a = await createStudent('a@example.com', 'Student A');
    const b = await createStudent('b@example.com', 'Student B');
    const before = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: a } });

    // Not allowed by the type; simulates unvalidated input reaching the repository.
    const hostile = {
      fullName: 'Renamed',
      userId: b,
      createdAt: new Date('2000-01-01T00:00:00Z'),
      updatedAt: new Date('2000-01-01T00:00:00Z'),
      onboardingCompletedAt: null,
    } as unknown as Parameters<typeof repository.updateByUserId>[1];
    expect(await repository.updateByUserId(a, hostile)).toBe(true);

    const after = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: a } });
    expect(after.fullName).toBe('Renamed'); // the allowed column still changes
    expect(after.userId).toBe(a);
    expect(after.createdAt.toISOString()).toBe(before.createdAt.toISOString());
    expect(after.onboardingCompletedAt).toEqual(before.onboardingCompletedAt);
    expect(await prisma.studentProfile.count()).toBe(2);
    expect((await prisma.studentProfile.findUniqueOrThrow({ where: { userId: b } })).fullName).toBe(
      'Student B',
    );
  });

  it('reports false when there is no profile to update', async () => {
    expect(await repository.updateByUserId('0'.repeat(36), { fullName: 'X' })).toBe(false);
  });

  it('works inside a transaction with the same methods', async () => {
    const a = await createStudent('a@example.com', 'Student A');
    await expect(
      withTransaction(prisma, async (tx) => {
        await createProfileRepository(tx).updateByUserId(a, { fullName: 'Changed' });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect((await repository.findByUserId(a))?.fullName).toBe('Student A');
  });
});
