import type { Seeder } from './index.js';

export const DEMO_STUDENT_EMAIL = 'demo@edumetrics.local';

/**
 * Dev-only demo student (DB-008): verified email, finished onboarding, and NO password yet, because
 * password hashing arrives in F-05. F-05 should set an Argon2id password here so the demo account
 * can log in. An existing demo user is left exactly as it is.
 */
export const demoStudentSeeder: Seeder = {
  name: 'demoStudent',
  async run(db) {
    const existing = await db.user.findUnique({
      where: { email: DEMO_STUDENT_EMAIL },
      select: { id: true },
    });
    if (existing) return { created: 0 };

    const now = new Date();
    await db.user.create({
      data: {
        email: DEMO_STUDENT_EMAIL,
        emailVerifiedAt: now,
        profile: {
          create: {
            fullName: 'Demo Student',
            universityName: 'Demo University',
            degree: 'B.Tech',
            branch: 'Computer Science',
            admissionYear: 2023,
            graduationYear: 2027,
            currentSemester: 4,
            onboardingCompletedAt: now,
          },
        },
      },
    });
    return { created: 1 };
  },
};
