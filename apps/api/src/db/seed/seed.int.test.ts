import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestPrisma } from '../../test-utils/db.js';
import { DEMO_STUDENT_EMAIL } from './demoStudent.js';
import { allSeeders, runSeeders } from './index.js';

const prisma = createTestPrisma();

const seed = (log: (line: string) => void = () => undefined) =>
  runSeeders(prisma, allSeeders, { nodeEnv: 'test', log });

beforeEach(async () => {
  await clearDatabase(prisma);
});

afterAll(async () => {
  await clearDatabase(prisma);
  await prisma.$disconnect();
});

describe('seed (DB-008)', () => {
  it('creates a demo student with a finished profile and no password', async () => {
    await seed();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: DEMO_STUDENT_EMAIL },
      include: { profile: true },
    });
    expect(user.passwordHash).toBeNull(); // F-05 adds hashing and sets the password
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.profile?.onboardingCompletedAt).not.toBeNull();
    expect(user.profile?.fullName).toBeTruthy();
  });

  it('is idempotent: running twice changes nothing', async () => {
    await seed();
    const first = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_STUDENT_EMAIL } });
    await seed();
    await seed();
    const after = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_STUDENT_EMAIL } });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.studentProfile.count()).toBe(1);
    expect(after.id).toBe(first.id);
    expect(after.createdAt.toISOString()).toBe(first.createdAt.toISOString());
    expect(after.updatedAt.toISOString()).toBe(first.updatedAt.toISOString());
  });

  it('does not overwrite edits made to the demo profile', async () => {
    await seed();
    await prisma.studentProfile.updateMany({ data: { fullName: 'Edited Name' } });
    await seed();
    expect((await prisma.studentProfile.findFirstOrThrow()).fullName).toBe('Edited Name');
  });

  it('reports counts only, never the email', async () => {
    const lines: string[] = [];
    await seed((line) => lines.push(line));
    await seed((line) => lines.push(line));
    expect(lines).toEqual(['demoStudent: created 1', 'demoStudent: created 0']);
    expect(lines.join('\n')).not.toContain('@');
  });
});
