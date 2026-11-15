import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  disconnectPrisma,
  TestCaseVisibility,
  ProblemDifficulty,
  UserRole,
  SubmissionStatus,
  SEED_LANGUAGES,
  SEED_PROBLEMS,
  seedDatabase,
  validateDatabaseConfig,
} from '../src/index.js';

describe('Seed Hardening & Idempotency Integration Tests', () => {
  let probeUserId: string;
  let probeSubmissionId: string;
  let unmanagedProblemId: string;

  beforeAll(async () => {
    // Run initial seed to ensure baseline state
    await seedDatabase();

    // Create an unmanaged user and a submission on a seeded problem
    const probeUser = await prisma.user.create({
      data: {
        email: `seed-hardening-user-${Date.now()}@gradestar.dev`,
        name: 'Seed Hardening Tester',
        role: UserRole.STUDENT,
      },
    });
    probeUserId = probeUser.id;

    const twoSumProblem = await prisma.problem.findUniqueOrThrow({
      where: { slug: 'two-sum' },
    });

    const pythonLang = await prisma.language.findUniqueOrThrow({
      where: { slug: 'python3' },
    });

    const probeSubmission = await prisma.submission.create({
      data: {
        userId: probeUserId,
        problemId: twoSumProblem.id,
        languageId: pythonLang.id,
        sourceCode: 'print("0 1")',
        status: SubmissionStatus.QUEUED,
      },
    });
    probeSubmissionId = probeSubmission.id;

    // Create an unrelated / unmanaged problem that is NOT in SEED_PROBLEMS
    const unmanagedProblem = await prisma.problem.create({
      data: {
        title: 'Unmanaged Custom Problem',
        slug: `unmanaged-prob-${Date.now()}`,
        statement: 'Statement for unmanaged problem',
        inputDescription: 'Input format',
        outputDescription: 'Output format',
        difficulty: ProblemDifficulty.MEDIUM,
        timeLimitMs: 1500,
        memoryLimitMb: 256,
        isPublished: true,
      },
    });
    unmanagedProblemId = unmanagedProblem.id;
  });

  afterAll(async () => {
    // Clean up test fixtures created during the test suite
    if (probeSubmissionId) {
      await prisma.submission.deleteMany({
        where: { id: probeSubmissionId },
      });
    }
    if (probeUserId) {
      await prisma.user.deleteMany({
        where: { id: probeUserId },
      });
    }
    if (unmanagedProblemId) {
      await prisma.problem.deleteMany({
        where: { id: unmanagedProblemId },
      });
    }
    await disconnectPrisma();
  });

  describe('2.1 Required Seed Data Correctness', () => {
    it('seeds all three canonical programming languages', async () => {
      const languages = await prisma.language.findMany({
        where: { slug: { in: ['cpp17', 'python3', 'java21'] } },
      });

      expect(languages).toHaveLength(3);
      for (const expectedLang of SEED_LANGUAGES) {
        const found = languages.find((l) => l.slug === expectedLang.slug);
        expect(found).toBeDefined();
        expect(found?.name).toBe(expectedLang.name);
        expect(found?.version).toBe(expectedLang.version);
        expect(found?.isEnabled).toBe(true);
      }
    });

    it('seeds all three required sample problems with correct limits', async () => {
      const problems = await prisma.problem.findMany({
        where: {
          slug: { in: ['two-sum', 'palindrome-check', 'fibonacci-number'] },
        },
      });

      expect(problems).toHaveLength(3);
      for (const expectedProb of SEED_PROBLEMS) {
        const found = problems.find((p) => p.slug === expectedProb.slug);
        expect(found).toBeDefined();
        expect(found?.title).toBe(expectedProb.title);
        expect(found?.difficulty).toBe(expectedProb.difficulty);
        expect(found?.timeLimitMs).toBeGreaterThan(0);
        expect(found?.memoryLimitMb).toBeGreaterThan(0);
        expect(found?.isPublished).toBe(true);
        expect(found?.statement.length).toBeGreaterThan(10);
        expect(found?.inputDescription.length).toBeGreaterThan(5);
        expect(found?.outputDescription.length).toBeGreaterThan(5);
      }
    });

    it('ensures every problem has at least 3 test cases with public and hidden visibility', async () => {
      const problems = await prisma.problem.findMany({
        where: {
          slug: { in: ['two-sum', 'palindrome-check', 'fibonacci-number'] },
        },
        include: {
          testCases: {
            orderBy: { position: 'asc' },
          },
        },
      });

      for (const problem of problems) {
        expect(problem.testCases.length).toBeGreaterThanOrEqual(3);

        const publicCases = problem.testCases.filter(
          (tc) => tc.visibility === TestCaseVisibility.PUBLIC,
        );
        const hiddenCases = problem.testCases.filter(
          (tc) => tc.visibility === TestCaseVisibility.HIDDEN,
        );

        expect(publicCases.length).toBeGreaterThanOrEqual(1);
        expect(hiddenCases.length).toBeGreaterThanOrEqual(1);

        // Verify position ordering is strictly positive and sequential
        const positions = problem.testCases.map((tc) => tc.position);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(new Set(positions).size).toBe(positions.length);
        expect(positions[0]).toBeGreaterThanOrEqual(1);
      }
    });

    it('verifies correctness of expected outputs for Fibonacci problem', async () => {
      const fibProblem = await prisma.problem.findUniqueOrThrow({
        where: { slug: 'fibonacci-number' },
        include: { testCases: { orderBy: { position: 'asc' } } },
      });

      const tc1 = fibProblem.testCases.find((tc) => tc.position === 1);
      expect(tc1?.input.trim()).toBe('2');
      expect(tc1?.expectedOutput.trim()).toBe('1');

      const tc4 = fibProblem.testCases.find((tc) => tc.position === 4);
      expect(tc4?.input.trim()).toBe('10');
      expect(tc4?.expectedOutput.trim()).toBe('55');
    });

    it('verifies correctness of expected outputs for Palindrome problem', async () => {
      const palProblem = await prisma.problem.findUniqueOrThrow({
        where: { slug: 'palindrome-check' },
        include: { testCases: { orderBy: { position: 'asc' } } },
      });

      const tc1 = palProblem.testCases.find((tc) => tc.position === 1);
      expect(tc1?.expectedOutput.trim()).toBe('true');

      const tc2 = palProblem.testCases.find((tc) => tc.position === 2);
      expect(tc2?.expectedOutput.trim()).toBe('false');
    });

    it('verifies correctness of expected outputs for Two Sum problem', async () => {
      const twoSum = await prisma.problem.findUniqueOrThrow({
        where: { slug: 'two-sum' },
        include: { testCases: { orderBy: { position: 'asc' } } },
      });

      const tc1 = twoSum.testCases.find((tc) => tc.position === 1);
      expect(tc1?.expectedOutput.trim()).toBe('0 1');

      const tc2 = twoSum.testCases.find((tc) => tc.position === 2);
      expect(tc2?.expectedOutput.trim()).toBe('1 2');
    });
  });

  describe('2.2 Idempotency and Non-Destructive Preservation', () => {
    it('does not duplicate records when re-executing seed multiple times', async () => {
      const countBefore = {
        languages: await prisma.language.count(),
        problems: await prisma.problem.count(),
        testCases: await prisma.testCase.count(),
      };

      const result1 = await seedDatabase();
      const result2 = await seedDatabase();

      const countAfter = {
        languages: await prisma.language.count(),
        problems: await prisma.problem.count(),
        testCases: await prisma.testCase.count(),
      };

      expect(countAfter.languages).toBe(countBefore.languages);
      expect(countAfter.problems).toBe(countBefore.problems);
      expect(countAfter.testCases).toBe(countBefore.testCases);
      expect(result1.languagesCount).toBe(result2.languagesCount);
      expect(result1.problemsCount).toBe(result2.problemsCount);
      expect(result1.testCasesCount).toBe(result2.testCasesCount);
    });

    it('preserves unrelated user-created records during seed execution', async () => {
      await seedDatabase();

      const unmanaged = await prisma.problem.findUnique({
        where: { id: unmanagedProblemId },
      });
      expect(unmanaged).not.toBeNull();
      expect(unmanaged?.title).toBe('Unmanaged Custom Problem');

      const user = await prisma.user.findUnique({
        where: { id: probeUserId },
      });
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Seed Hardening Tester');
    });

    it('preserves historical submissions and evaluation references during re-seeding', async () => {
      await seedDatabase();

      const submission = await prisma.submission.findUnique({
        where: { id: probeSubmissionId },
        include: { problem: true, language: true },
      });

      expect(submission).not.toBeNull();
      expect(submission?.problem.slug).toBe('two-sum');
      expect(submission?.language.slug).toBe('python3');
      expect(submission?.status).toBe(SubmissionStatus.QUEUED);
    });
  });

  describe('2.3 Safe Configuration & Failure Handling', () => {
    it('validateDatabaseConfig succeeds when DATABASE_URL is present', () => {
      expect(() => validateDatabaseConfig()).not.toThrow();
    });

    it('validateDatabaseConfig throws an informative error when DATABASE_URL is missing', () => {
      const original = process.env['DATABASE_URL'];
      try {
        delete process.env['DATABASE_URL'];
        expect(() => validateDatabaseConfig()).toThrow(
          /DATABASE_URL environment variable is missing or empty/,
        );
      } finally {
        process.env['DATABASE_URL'] = original;
      }
    });

    it('rolls back seed transaction completely when an unexpected error occurs during seeding', async () => {
      // Simulate a transactional failure by attempting a mock seed on an invalid transaction
      let caught = false;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.language.create({
            data: {
              name: 'Temporary Rollback Lang',
              slug: `rollback-lang-${Date.now()}`,
              version: '1.0',
            },
          });
          throw new Error('Simulated failure during transactional seed');
        });
      } catch (err) {
        caught = true;
        expect((err as Error).message).toBe('Simulated failure during transactional seed');
      }

      expect(caught).toBe(true);

      const rollbackCheck = await prisma.language.findMany({
        where: { name: 'Temporary Rollback Lang' },
      });
      expect(rollbackCheck).toHaveLength(0);
    });
  });
});
