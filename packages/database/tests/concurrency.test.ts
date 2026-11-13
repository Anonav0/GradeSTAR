import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  disconnectPrisma,
  UserRole,
  ProblemDifficulty,
  TestCaseVisibility,
  SubmissionStatus,
  Verdict,
  isUniqueConstraintViolation,
  isForeignKeyViolation,
  atomicTransitionSubmissionStatus,
  withTransaction,
} from '../src/index.js';

describe('Concurrency, Atomic Updates & Transaction Rollback Tests', () => {
  let testUserId: string;
  let testProblemId: string;
  let testLangId: string;
  let testCaseId: string;

  beforeAll(async () => {
    // Clean up any test records
    await prisma.testCaseResult.deleteMany({
      where: { submission: { user: { email: { startsWith: 'concurrency-test-' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { email: { startsWith: 'concurrency-test-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { problem: { slug: { startsWith: 'concurrency-prob-' } } },
    });
    await prisma.problem.deleteMany({
      where: { slug: { startsWith: 'concurrency-prob-' } },
    });
    await prisma.language.deleteMany({
      where: { slug: { startsWith: 'concurrency-lang-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'concurrency-test-' } },
    });

    // Create baseline entities
    const user = await prisma.user.create({
      data: {
        email: `concurrency-test-${Date.now()}@gradestar.dev`,
        name: 'Concurrency Tester',
        role: UserRole.STUDENT,
      },
    });
    testUserId = user.id;

    const lang = await prisma.language.create({
      data: {
        name: 'Concurrency Node',
        slug: `concurrency-lang-${Date.now()}`,
        version: '20.0',
      },
    });
    testLangId = lang.id;

    const problem = await prisma.problem.create({
      data: {
        title: 'Concurrency Problem',
        slug: `concurrency-prob-${Date.now()}`,
        statement: 'Concurrency problem statement',
        inputDescription: 'Input format',
        outputDescription: 'Output format',
        difficulty: ProblemDifficulty.MEDIUM,
        timeLimitMs: 1500,
        memoryLimitMb: 128,
        isPublished: true,
      },
    });
    testProblemId = problem.id;

    const tc = await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        input: '42',
        expectedOutput: '42',
        position: 1,
        visibility: TestCaseVisibility.PUBLIC,
      },
    });
    testCaseId = tc.id;
  });

  afterAll(async () => {
    await prisma.testCaseResult.deleteMany({
      where: { submission: { user: { email: { startsWith: 'concurrency-test-' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { email: { startsWith: 'concurrency-test-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { problem: { slug: { startsWith: 'concurrency-prob-' } } },
    });
    await prisma.problem.deleteMany({
      where: { slug: { startsWith: 'concurrency-prob-' } },
    });
    await prisma.language.deleteMany({
      where: { slug: { startsWith: 'concurrency-lang-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'concurrency-test-' } },
    });
    await disconnectPrisma();
  });

  describe('Section 8.A: Concurrent Unique Email Creation', () => {
    it('allows exactly 1 insert and rejects concurrent duplicate email attempts', async () => {
      const email = `concurrency-test-dupe-${Date.now()}@gradestar.dev`;

      const attempts = Array.from({ length: 5 }, (_, i) =>
        prisma.user.create({
          data: {
            email,
            name: `Candidate ${i}`,
            role: UserRole.STUDENT,
          },
        }),
      );

      const results = await Promise.allSettled(attempts);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);

      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect(isUniqueConstraintViolation(rej.reason)).toBe(true);
        }
      }
    });
  });

  describe('Section 8.B: Concurrent Queue Job Identifier Uniqueness', () => {
    it('enforces uniqueness on non-null queueJobId under concurrent creation', async () => {
      const queueJobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const attempts = [
        prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'console.log(1);',
            status: SubmissionStatus.QUEUED,
            queueJobId,
          },
        }),
        prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'console.log(2);',
            status: SubmissionStatus.QUEUED,
            queueJobId,
          },
        }),
      ];

      const results = await Promise.allSettled(attempts);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      if (rejected[0]?.status === 'rejected') {
        expect(isUniqueConstraintViolation(rejected[0].reason)).toBe(true);
      }

      // Cleanup
      if (fulfilled[0]?.status === 'fulfilled') {
        await prisma.submission.delete({ where: { id: fulfilled[0].value.id } });
      }
    });
  });

  describe('Section 8.C: Concurrent Duplicate TestCaseResult Prevention', () => {
    it('enforces composite uniqueness on (submissionId, testCaseId)', async () => {
      const now = new Date();
      const submission = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'console.log(42);',
          status: SubmissionStatus.RUNNING,
          createdAt: now,
          startedAt: now,
        },
      });

      const attempts = [
        prisma.testCaseResult.create({
          data: {
            submissionId: submission.id,
            testCaseId,
            verdict: Verdict.ACCEPTED,
            executionTimeMs: 45,
            memoryUsedKb: 2048,
          },
        }),
        prisma.testCaseResult.create({
          data: {
            submissionId: submission.id,
            testCaseId,
            verdict: Verdict.WRONG_ANSWER,
            executionTimeMs: 50,
            memoryUsedKb: 2100,
          },
        }),
      ];

      const results = await Promise.allSettled(attempts);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      if (rejected[0]?.status === 'rejected') {
        expect(isUniqueConstraintViolation(rejected[0].reason)).toBe(true);
      }

      await prisma.submission.delete({ where: { id: submission.id } });
    });
  });

  describe('Section 8.D: TestCase Ordering Uniqueness', () => {
    it('rejects duplicate position for the same problem', async () => {
      let threw = false;
      try {
        await prisma.testCase.create({
          data: {
            problemId: testProblemId,
            input: '99',
            expectedOutput: '99',
            position: 1, // Already exists from beforeAll
            visibility: TestCaseVisibility.PUBLIC,
          },
        });
      } catch (err) {
        threw = true;
        expect(isUniqueConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });
  });

  describe('Section 8.E: Conditional Submission Updates & Race Protection', () => {
    it('allows only one concurrent worker to transition QUEUED to RUNNING', async () => {
      const submission = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'console.log(1);',
          status: SubmissionStatus.QUEUED,
        },
      });

      // Simulate 2 competing workers trying to claim the same queued job
      const workerA = atomicTransitionSubmissionStatus(prisma, {
        submissionId: submission.id,
        fromStatus: SubmissionStatus.QUEUED,
        toStatus: SubmissionStatus.RUNNING,
        startedAt: new Date(),
      });

      const workerB = atomicTransitionSubmissionStatus(prisma, {
        submissionId: submission.id,
        fromStatus: SubmissionStatus.QUEUED,
        toStatus: SubmissionStatus.RUNNING,
        startedAt: new Date(),
      });

      const [resA, resB] = await Promise.all([workerA, workerB]);

      const successCount = [resA, resB].filter((r) => r.success).length;
      const failureCount = [resA, resB].filter((r) => !r.success).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      const failedResult = [resA, resB].find((r) => !r.success);
      expect(failedResult?.reason).toBe('STALE_STATE_OR_NOT_FOUND');

      // Verify the database has RUNNING
      const reloaded = await prisma.submission.findUnique({
        where: { id: submission.id },
      });
      expect(reloaded?.status).toBe(SubmissionStatus.RUNNING);

      await prisma.submission.delete({ where: { id: submission.id } });
    });

    it('rejects illegal status transition (COMPLETED -> RUNNING)', async () => {
      const created = new Date();
      const started = new Date(created.getTime() + 10);
      const completed = new Date(started.getTime() + 100);

      const submission = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'console.log(1);',
          status: SubmissionStatus.COMPLETED,
          verdict: Verdict.ACCEPTED,
          createdAt: created,
          startedAt: started,
          completedAt: completed,
        },
      });

      const result = await atomicTransitionSubmissionStatus(prisma, {
        submissionId: submission.id,
        fromStatus: SubmissionStatus.COMPLETED,
        toStatus: SubmissionStatus.RUNNING,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INVALID_TRANSITION');

      await prisma.submission.delete({ where: { id: submission.id } });
    });

    it('prevents stale worker from modifying a CANCELLED submission', async () => {
      const submission = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'console.log(1);',
          status: SubmissionStatus.CANCELLED,
        },
      });

      // Stale worker believes submission is QUEUED
      const result = await atomicTransitionSubmissionStatus(prisma, {
        submissionId: submission.id,
        fromStatus: SubmissionStatus.QUEUED,
        toStatus: SubmissionStatus.RUNNING,
        startedAt: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('STALE_STATE_OR_NOT_FOUND');

      await prisma.submission.delete({ where: { id: submission.id } });
    });
  });

  describe('Section 8.F: Multi-Operation Transaction Rollback', () => {
    it('rolls back all operations when a transaction aborts', async () => {
      const probeEmail = `concurrency-test-rollback-${Date.now()}@gradestar.dev`;

      let threw = false;
      try {
        await withTransaction(prisma, async (tx) => {
          // Step 1: create user
          await tx.user.create({
            data: {
              email: probeEmail,
              name: 'Rollback User',
              role: UserRole.STUDENT,
            },
          });

          // Step 2: intentionally trigger an unhandled failure
          throw new Error('Simulated failure during evaluation orchestration');
        });
      } catch (err) {
        threw = true;
        expect((err as Error).message).toBe('Simulated failure during evaluation orchestration');
      }

      expect(threw).toBe(true);

      // Verify probe user was NOT committed
      const foundUser = await prisma.user.findUnique({
        where: { email: probeEmail },
      });
      expect(foundUser).toBeNull();
    });
  });

  describe('Foreign Key Deletion Invariants', () => {
    it('prevents deletion of Problem when historical submissions exist (Restrict/NoAction)', async () => {
      const problem = await prisma.problem.create({
        data: {
          title: 'Protected Problem',
          slug: `concurrency-prob-protect-${Date.now()}`,
          statement: 'Protected problem statement',
          inputDescription: 'Input format',
          outputDescription: 'Output format',
          difficulty: ProblemDifficulty.EASY,
          timeLimitMs: 1000,
          memoryLimitMb: 128,
        },
      });

      const submission = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: problem.id,
          languageId: testLangId,
          sourceCode: 'console.log(1)',
          status: SubmissionStatus.QUEUED,
        },
      });

      let threw = false;
      try {
        await prisma.problem.delete({
          where: { id: problem.id },
        });
      } catch (err) {
        threw = true;
        expect(isForeignKeyViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);

      // Clean up in proper order
      await prisma.submission.delete({ where: { id: submission.id } });
      await prisma.problem.delete({ where: { id: problem.id } });
    });

    it('cascades deletion of TestCaseResults when Submission is deleted', async () => {
      const now = new Date();
      const submission = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'console.log(1)',
          status: SubmissionStatus.RUNNING,
          createdAt: now,
          startedAt: now,
        },
      });

      const result = await prisma.testCaseResult.create({
        data: {
          submissionId: submission.id,
          testCaseId,
          verdict: Verdict.ACCEPTED,
          executionTimeMs: 10,
          memoryUsedKb: 512,
        },
      });

      expect(result.id).toBeDefined();

      // Deleting submission should cascade to result
      await prisma.submission.delete({ where: { id: submission.id } });

      const reloadedResult = await prisma.testCaseResult.findUnique({
        where: { id: result.id },
      });
      expect(reloadedResult).toBeNull();
    });
  });
});
