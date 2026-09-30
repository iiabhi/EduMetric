import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { clearDatabase, createTestPrisma } from '../test-utils/db.js';

const prisma = createTestPrisma();

const hash = (n: number): string => n.toString(16).padStart(64, '0');

const createUser = (email: string) => prisma.user.create({ data: { email } });

const rejects = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(code);
};

beforeEach(async () => {
  await clearDatabase(prisma);
});

afterAll(async () => {
  await clearDatabase(prisma);
  await prisma.$disconnect();
});

describe('unique constraints', () => {
  it('rejects a duplicate email, including a case-only variant', async () => {
    await createUser('a@example.com');
    await rejects(createUser('a@example.com'), 'P2002');
    await rejects(createUser('A@Example.com'), 'P2002');
  });

  it('rejects a duplicate (provider, providerSubject) but allows another provider', async () => {
    const a = await createUser('a@example.com');
    const b = await createUser('b@example.com');
    const data = { provider: 'google', providerSubject: 'sub-1', email: 'a@example.com' };
    await prisma.oAuthAccount.create({ data: { ...data, userId: a.id } });
    await rejects(prisma.oAuthAccount.create({ data: { ...data, userId: b.id } }), 'P2002');
    await prisma.oAuthAccount.create({ data: { ...data, provider: 'github', userId: b.id } });
  });

  it('rejects duplicate refreshTokenHash and tokenHash', async () => {
    const user = await createUser('a@example.com');
    const session = { userId: user.id, familyId: user.id, expiresAt: new Date() };
    await prisma.session.create({ data: { ...session, refreshTokenHash: hash(1) } });
    await rejects(
      prisma.session.create({ data: { ...session, refreshTokenHash: hash(1) } }),
      'P2002',
    );
    const token = { userId: user.id, type: 'EMAIL_VERIFY' as const, expiresAt: new Date() };
    await prisma.authToken.create({ data: { ...token, tokenHash: hash(2) } });
    await rejects(prisma.authToken.create({ data: { ...token, tokenHash: hash(2) } }), 'P2002');
  });

  it('allows one profile per user', async () => {
    const user = await createUser('a@example.com');
    await prisma.studentProfile.create({ data: { userId: user.id, fullName: 'A' } });
    await rejects(
      prisma.studentProfile.create({ data: { userId: user.id, fullName: 'B' } }),
      'P2002',
    );
  });
});

describe('foreign keys', () => {
  it('rejects rows for a user that does not exist', async () => {
    await rejects(
      prisma.studentProfile.create({ data: { userId: '0'.repeat(36), fullName: 'A' } }),
      'P2003',
    );
  });

  it('deleting a user removes all of its identity rows (DB-002)', async () => {
    const user = await createUser('a@example.com');
    const other = await createUser('b@example.com');
    await prisma.oAuthAccount.create({
      data: { userId: user.id, provider: 'google', providerSubject: 's', email: 'a@example.com' },
    });
    const first = await prisma.session.create({
      data: {
        userId: user.id,
        familyId: user.id,
        refreshTokenHash: hash(1),
        expiresAt: new Date(),
      },
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        familyId: user.id,
        refreshTokenHash: hash(2),
        expiresAt: new Date(),
        replacedById: first.id,
      },
    });
    await prisma.authToken.create({
      data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: hash(3), expiresAt: new Date() },
    });
    await prisma.studentProfile.create({ data: { userId: user.id, fullName: 'A' } });
    await prisma.studentProfile.create({ data: { userId: other.id, fullName: 'B' } });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.oAuthAccount.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.authToken.count()).toBe(0);
    expect(await prisma.studentProfile.count()).toBe(1);
  });
});

describe('column types', () => {
  it('keeps decimals exact (TD-015) and applies the grading scale default', async () => {
    const user = await createUser('a@example.com');
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        fullName: 'A',
        officialCgpa: new Prisma.Decimal('9.25'),
        totalRequiredCredits: new Prisma.Decimal('120.5'),
      },
    });
    expect(profile.officialCgpa?.toString()).toBe('9.25');
    expect(profile.totalRequiredCredits?.toString()).toBe('120.5');
    expect(profile.gradingScaleMax.toString()).toBe('10');
  });

  it('stores timestamps in UTC whatever the process time zone (TD-014)', async () => {
    expect(process.env.TZ).not.toBe('UTC');
    const instant = new Date('2026-01-01T00:00:00.000Z');
    const user = await prisma.user.create({
      data: { email: 'a@example.com', emailVerifiedAt: instant },
    });
    const back = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(back.emailVerifiedAt?.toISOString()).toBe(instant.toISOString());
    const rows = await prisma.$queryRaw<{ utcValue: string }[]>`
      SELECT DATE_FORMAT(emailVerifiedAt, '%Y-%m-%d %H:%i:%s.%f') AS utcValue
      FROM User WHERE id = ${user.id}`;
    expect(rows[0]?.utcValue).toBe('2026-01-01 00:00:00.000000');
  });

  it('round trips non-BMP text (utf8mb4)', async () => {
    const user = await createUser('a@example.com');
    await prisma.studentProfile.create({ data: { userId: user.id, fullName: 'राहुल 😀' } });
    const back = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(back.fullName).toBe('राहुल 😀');
  });

  it('has no plaintext token or password columns (AUTH-004)', async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()`;
    const names = rows.map((r) => r.name.toLowerCase());
    for (const banned of ['password', 'token', 'refreshtoken', 'secret']) {
      expect(names).not.toContain(banned);
    }
  });
});
