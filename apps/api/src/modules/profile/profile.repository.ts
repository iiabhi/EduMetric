import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../../lib/transaction.js';

// List the columns a caller needs (PERF-005) instead of returning whole rows.
const profileSelect = {
  userId: true,
  fullName: true,
  universityName: true,
  degree: true,
  branch: true,
  admissionYear: true,
  graduationYear: true,
  currentSemester: true,
  studentIdentifier: true,
  gradingScaleMax: true,
  officialCgpa: true,
  totalRequiredCredits: true,
  onboardingCompletedAt: true,
} satisfies Prisma.StudentProfileSelect;

export type ProfileRecord = Prisma.StudentProfileGetPayload<{ select: typeof profileSelect }>;
// The only columns an update may change. userId (the ownership key), timestamps and
// onboardingCompletedAt are deliberately absent: the onboarding endpoint owns that last one.
const editableColumns = [
  'fullName',
  'universityName',
  'degree',
  'branch',
  'admissionYear',
  'graduationYear',
  'currentSemester',
  'studentIdentifier',
  'gradingScaleMax',
  'officialCgpa',
  'totalRequiredCredits',
] as const;
const editable = new Set<string>(editableColumns);

export type ProfileChanges = Pick<
  Prisma.StudentProfileUncheckedUpdateManyInput,
  (typeof editableColumns)[number]
>;

/** Drops any key that is not an editable column, even if unvalidated input smuggled it past the type. */
const onlyEditable = (changes: ProfileChanges): ProfileChanges =>
  Object.fromEntries(Object.entries(changes).filter(([key]) => editable.has(key)));

/**
 * The repository pattern for student-owned data (SRD 7.2, DB-001). Copy it for new features:
 * - a factory that takes a normal or transaction client, so services can compose transactions;
 * - every method takes `userId` and puts it in the `where`, so one student can never reach
 *   another's row. A service turns "no row" into a 404 (CONV-005).
 */
export const createProfileRepository = (db: DbClient) => ({
  findByUserId(userId: string): Promise<ProfileRecord | null> {
    return db.studentProfile.findUnique({ where: { userId }, select: profileSelect });
  },

  /** Changes editable columns only (see `editableColumns`). Returns false when the user has no profile. */
  async updateByUserId(userId: string, changes: ProfileChanges): Promise<boolean> {
    const result = await db.studentProfile.updateMany({
      where: { userId },
      data: onlyEditable(changes),
    });
    return result.count > 0;
  },
});

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
