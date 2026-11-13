import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  disconnectPrisma,
  UserRole,
  ProblemDifficulty,
  TestCaseVisibility,
  SubmissionStatus,
  Verdict,
  isCheckConstraintViolation,
  classifyDatabaseError,
} from '../src/index.js';

describe('Database CHECK Constraints & Integrity Tests', () => {
  let testUserId: string;
  let testProblemId: string;
  let testLangId: string;
  let testCaseId: string;

  beforeAll(async () => {
    // Clean up old test fixtures
    await prisma.testCaseResult.deleteMany({
      where: { submission: { user: { email: { startsWith: 'integrity-test-' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { email: { startsWith: 'integrity-test-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { problem: { slug: { startsWith: 'integrity-prob-' } } },
    });
    await prisma.problem.deleteMany({
      where: { slug: { startsWith: 'integrity-prob-' } },
    });
    await prisma.language.deleteMany({
      where: { slug: { startsWith: 'integrity-lang-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'integrity-test-' } },
    });

    // Create shared fixtures
    const user = await prisma.user.create({
      data: {
        email: `integrity-test-${Date.now()}@gradestar.dev`,
        name: 'Integrity Tester',
        role: UserRole.STUDENT,
      },
    });
    testUserId = user.id;

    const lang = await prisma.language.create({
      data: {
        name: 'Integrity Python',
        slug: `integrity-lang-${Date.now()}`,
        version: '3.11',
      },
    });
    testLangId = lang.id;

    const problem = await prisma.problem.create({
      data: {
        title: 'Integrity Test Problem',
        slug: `integrity-prob-${Date.now()}`,
        statement: 'Integrity problem statement',
        inputDescription: 'Two numbers',
        outputDescription: 'Sum of numbers',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        isPublished: true,
      },
    });
    testProblemId = problem.id;

    const tc = await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        input: '1 2',
        expectedOutput: '3',
        position: 1,
        visibility: TestCaseVisibility.PUBLIC,
      },
    });
    testCaseId = tc.id;
  });

  afterAll(async () => {
    await prisma.testCaseResult.deleteMany({
      where: { submission: { user: { email: { startsWith: 'integrity-test-' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { email: { startsWith: 'integrity-test-' } } },
    });
    await prisma.testCase.deleteMany({
      where: { problem: { slug: { startsWith: 'integrity-prob-' } } },
    });
    await prisma.problem.deleteMany({
      where: { slug: { startsWith: 'integrity-prob-' } },
    });
    await prisma.language.deleteMany({
      where: { slug: { startsWith: 'integrity-lang-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'integrity-test-' } },
    });
    await disconnectPrisma();
  });

  describe('Numeric Limits Constraints', () => {
    it('rejects Problem with non-positive timeLimitMs (<= 0)', async () => {
      let threw = false;
      try {
        await prisma.problem.create({
          data: {
            title: 'Invalid Time Limit',
            slug: `integrity-prob-inv-time-${Date.now()}`,
            statement: 'Invalid time limit problem',
            inputDescription: 'Input',
            outputDescription: 'Output',
            difficulty: ProblemDifficulty.EASY,
            timeLimitMs: 0,
            memoryLimitMb: 256,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
        const classified = classifyDatabaseError(err);
        expect(classified.category).toBe('CHECK_CONSTRAINT_VIOLATION');
      }
      expect(threw).toBe(true);
    });

    it('rejects Problem with non-positive memoryLimitMb (<= 0)', async () => {
      let threw = false;
      try {
        await prisma.problem.create({
          data: {
            title: 'Invalid Memory Limit',
            slug: `integrity-prob-inv-mem-${Date.now()}`,
            statement: 'Invalid memory limit problem',
            inputDescription: 'Input',
            outputDescription: 'Output',
            difficulty: ProblemDifficulty.EASY,
            timeLimitMs: 1000,
            memoryLimitMb: -10,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects TestCase with non-positive position (< 1)', async () => {
      let threw = false;
      try {
        await prisma.testCase.create({
          data: {
            problemId: testProblemId,
            input: 'invalid',
            expectedOutput: 'invalid',
            position: 0,
            visibility: TestCaseVisibility.PUBLIC,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects TestCaseResult with negative executionTimeMs (< 0)', async () => {
      const now = new Date();
      const sub = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'print(3)',
          status: SubmissionStatus.RUNNING,
          createdAt: now,
          startedAt: now,
        },
      });

      let threw = false;
      try {
        await prisma.testCaseResult.create({
          data: {
            submissionId: sub.id,
            testCaseId,
            verdict: Verdict.ACCEPTED,
            executionTimeMs: -5,
            memoryUsedKb: 1024,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      } finally {
        await prisma.submission.delete({ where: { id: sub.id } });
      }
      expect(threw).toBe(true);
    });

    it('rejects TestCaseResult with negative memoryUsedKb (< 0)', async () => {
      const now = new Date();
      const sub = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'print(3)',
          status: SubmissionStatus.RUNNING,
          createdAt: now,
          startedAt: now,
        },
      });

      let threw = false;
      try {
        await prisma.testCaseResult.create({
          data: {
            submissionId: sub.id,
            testCaseId,
            verdict: Verdict.ACCEPTED,
            executionTimeMs: 120,
            memoryUsedKb: -1,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      } finally {
        await prisma.submission.delete({ where: { id: sub.id } });
      }
      expect(threw).toBe(true);
    });
  });

  describe('Temporal Lifecycle Constraints', () => {
    it('rejects Submission when completedAt precedes startedAt', async () => {
      const created = new Date();
      const started = new Date(created.getTime() + 10);
      const earlier = new Date(started.getTime() - 1000);

      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.COMPLETED,
            verdict: Verdict.ACCEPTED,
            createdAt: created,
            startedAt: started,
            completedAt: earlier,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects Submission when startedAt precedes createdAt', async () => {
      const created = new Date();
      const longAgo = new Date(created.getTime() - 3600000);

      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.RUNNING,
            createdAt: created,
            startedAt: longAgo,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });
  });

  describe('Status and Verdict Consistency Constraints', () => {
    it('rejects PENDING submission that carries a non-null verdict', async () => {
      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.PENDING,
            verdict: Verdict.ACCEPTED,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects QUEUED submission that carries a non-null verdict', async () => {
      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.QUEUED,
            verdict: Verdict.WRONG_ANSWER,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects RUNNING submission that carries a non-null verdict', async () => {
      const now = new Date();
      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.RUNNING,
            createdAt: now,
            startedAt: now,
            verdict: Verdict.TIME_LIMIT_EXCEEDED,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects COMPLETED submission with NULL verdict', async () => {
      const created = new Date();
      const started = new Date(created.getTime() + 10);
      const completed = new Date(started.getTime() + 100);
      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.COMPLETED,
            verdict: null,
            createdAt: created,
            startedAt: started,
            completedAt: completed,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('rejects FAILED submission with non-SYSTEM_ERROR evaluation verdict (e.g. ACCEPTED)', async () => {
      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.FAILED,
            verdict: Verdict.ACCEPTED,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('allows FAILED submission with verdict = SYSTEM_ERROR or NULL', async () => {
      const failedSub1 = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'print(1)',
          status: SubmissionStatus.FAILED,
          verdict: Verdict.SYSTEM_ERROR,
        },
      });
      expect(failedSub1.id).toBeDefined();

      const failedSub2 = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'print(1)',
          status: SubmissionStatus.FAILED,
          verdict: null,
        },
      });
      expect(failedSub2.id).toBeDefined();

      await prisma.submission.deleteMany({
        where: { id: { in: [failedSub1.id, failedSub2.id] } },
      });
    });

    it('rejects CANCELLED submission with non-null verdict', async () => {
      let threw = false;
      try {
        await prisma.submission.create({
          data: {
            userId: testUserId,
            problemId: testProblemId,
            languageId: testLangId,
            sourceCode: 'print(1)',
            status: SubmissionStatus.CANCELLED,
            verdict: Verdict.ACCEPTED,
          },
        });
      } catch (err) {
        threw = true;
        expect(isCheckConstraintViolation(err)).toBe(true);
      }
      expect(threw).toBe(true);
    });

    it('allows valid COMPLETED submission with ACCEPTED verdict and ordered timestamps', async () => {
      const created = new Date();
      const started = new Date(created.getTime() + 10);
      const completed = new Date(started.getTime() + 150);

      const validSub = await prisma.submission.create({
        data: {
          userId: testUserId,
          problemId: testProblemId,
          languageId: testLangId,
          sourceCode: 'print(1)',
          status: SubmissionStatus.COMPLETED,
          verdict: Verdict.ACCEPTED,
          createdAt: created,
          startedAt: started,
          completedAt: completed,
        },
      });

      expect(validSub.id).toBeDefined();
      expect(validSub.status).toBe(SubmissionStatus.COMPLETED);
      expect(validSub.verdict).toBe(Verdict.ACCEPTED);

      await prisma.submission.delete({ where: { id: validSub.id } });
    });
  });
});
