import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  disconnectPrisma,
  TestCaseVisibility,
  ProblemDifficulty,
  UserRole,
  SubmissionStatus,
  Verdict,
  getPublishedProblemBySlug,
  getPublicTestCases,
  getEvaluationTestCases,
  getEnabledLanguages,
  getUserSubmissions,
  getProblemSubmissions,
  getSubmissionWithDetails,
} from '../src/index.js';

describe('Representative Relational Queries & Confidentiality Integration Tests', () => {
  let testUserId: string;
  let testProblemId: string;
  let unpublishedProblemId: string;
  let testLangId: string;
  let disabledLangId: string;
  let testSubmissionId: string;
  let publicTestCaseId: string;
  let hiddenTestCaseId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `query-test-${Date.now()}@gradestar.dev`,
        name: 'Query Tester',
        role: UserRole.STUDENT,
      },
    });
    testUserId = user.id;

    // Create enabled and disabled languages
    const enabledLang = await prisma.language.create({
      data: {
        name: 'Query Active Rust',
        slug: `query-rust-${Date.now()}`,
        version: '1.75',
        isEnabled: true,
      },
    });
    testLangId = enabledLang.id;

    const disabledLang = await prisma.language.create({
      data: {
        name: 'Query Deprecated Ruby',
        slug: `query-ruby-${Date.now()}`,
        version: '2.5',
        isEnabled: false,
      },
    });
    disabledLangId = disabledLang.id;

    // Create published problem with public and hidden test cases
    const problem = await prisma.problem.create({
      data: {
        title: 'Query Published Problem',
        slug: `query-published-prob-${Date.now()}`,
        statement: 'Problem statement for relational query testing',
        inputDescription: 'Input description',
        outputDescription: 'Output description',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        isPublished: true,
      },
    });
    testProblemId = problem.id;

    // Unpublished problem
    const unpub = await prisma.problem.create({
      data: {
        title: 'Query Draft Problem',
        slug: `query-draft-prob-${Date.now()}`,
        statement: 'Draft statement',
        inputDescription: 'Input',
        outputDescription: 'Output',
        difficulty: ProblemDifficulty.MEDIUM,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        isPublished: false,
      },
    });
    unpublishedProblemId = unpub.id;

    // Add test cases: 2 public, 2 hidden
    const tc1 = await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        input: 'public input 1',
        expectedOutput: 'public output 1',
        visibility: TestCaseVisibility.PUBLIC,
        position: 1,
      },
    });
    publicTestCaseId = tc1.id;

    await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        input: 'public input 2',
        expectedOutput: 'public output 2',
        visibility: TestCaseVisibility.PUBLIC,
        position: 2,
      },
    });

    const tc3 = await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        input: 'super secret hidden input 3',
        expectedOutput: 'hidden output 3',
        visibility: TestCaseVisibility.HIDDEN,
        position: 3,
      },
    });
    hiddenTestCaseId = tc3.id;

    await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        input: 'super secret hidden input 4',
        expectedOutput: 'hidden output 4',
        visibility: TestCaseVisibility.HIDDEN,
        position: 4,
      },
    });

    // Create submission with test case results
    const started = new Date();
    const completed = new Date(started.getTime() + 120);

    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId: testProblemId,
        languageId: testLangId,
        sourceCode: 'fn main() { println!("42"); }',
        status: SubmissionStatus.COMPLETED,
        verdict: Verdict.ACCEPTED,
        createdAt: started,
        startedAt: started,
        completedAt: completed,
      },
    });
    testSubmissionId = submission.id;

    await prisma.testCaseResult.createMany({
      data: [
        {
          submissionId: testSubmissionId,
          testCaseId: publicTestCaseId,
          verdict: Verdict.ACCEPTED,
          executionTimeMs: 15,
          memoryUsedKb: 2048,
        },
        {
          submissionId: testSubmissionId,
          testCaseId: hiddenTestCaseId,
          verdict: Verdict.ACCEPTED,
          executionTimeMs: 18,
          memoryUsedKb: 2100,
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testSubmissionId) {
      await prisma.testCaseResult.deleteMany({
        where: { submissionId: testSubmissionId },
      });
      await prisma.submission.deleteMany({
        where: { id: testSubmissionId },
      });
    }
    if (testProblemId) {
      await prisma.testCase.deleteMany({
        where: { problemId: testProblemId },
      });
      await prisma.problem.deleteMany({
        where: { id: testProblemId },
      });
    }
    if (unpublishedProblemId) {
      await prisma.problem.deleteMany({
        where: { id: unpublishedProblemId },
      });
    }
    if (testUserId) {
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
    if (testLangId) {
      await prisma.language.deleteMany({
        where: { id: testLangId },
      });
    }
    if (disabledLangId) {
      await prisma.language.deleteMany({
        where: { id: disabledLangId },
      });
    }
    await disconnectPrisma();
  });

  describe('5.1 & 5.5 Problems and Hidden Test-Case Confidentiality', () => {
    it('retrieves published problem by slug', async () => {
      const prob = await prisma.problem.findUniqueOrThrow({
        where: { id: testProblemId },
      });
      const result = await getPublishedProblemBySlug(prisma, prob.slug);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(testProblemId);
      expect(result?.isPublished).toBe(true);
    });

    it('returns null when querying an unpublished problem slug', async () => {
      const unpub = await prisma.problem.findUniqueOrThrow({
        where: { id: unpublishedProblemId },
      });
      const result = await getPublishedProblemBySlug(prisma, unpub.slug);
      expect(result).toBeNull();
    });

    it('getPublicTestCases strictly excludes HIDDEN test cases and returns ordered public cases', async () => {
      const publicCases = await getPublicTestCases(prisma, testProblemId);

      expect(publicCases).toHaveLength(2);
      expect(publicCases.every((tc) => tc.visibility === TestCaseVisibility.PUBLIC)).toBe(true);

      // Verify none of the hidden test case inputs are returned
      const inputs = publicCases.map((tc) => tc.input);
      expect(inputs).toContain('public input 1');
      expect(inputs).toContain('public input 2');
      expect(inputs).not.toContain('super secret hidden input 3');
      expect(inputs).not.toContain('super secret hidden input 4');

      // Verify ordering by position
      expect(publicCases[0]?.position).toBe(1);
      expect(publicCases[1]?.position).toBe(2);
    });

    it('getEvaluationTestCases retrieves ALL test cases including hidden cases for trusted evaluator', async () => {
      const allCases = await getEvaluationTestCases(prisma, testProblemId);

      expect(allCases).toHaveLength(4);

      const visibilities = allCases.map((tc) => tc.visibility);
      expect(visibilities).toContain(TestCaseVisibility.PUBLIC);
      expect(visibilities).toContain(TestCaseVisibility.HIDDEN);

      const positions = allCases.map((tc) => tc.position);
      expect(positions).toEqual([1, 2, 3, 4]);
    });

    it('getPublishedProblemBySlug with includePublicTestCases excludes hidden test cases', async () => {
      const prob = await prisma.problem.findUniqueOrThrow({
        where: { id: testProblemId },
      });

      const result = (await getPublishedProblemBySlug(prisma, prob.slug, {
        includePublicTestCases: true,
      })) as { testCases: Array<{ visibility: TestCaseVisibility }> } | null;

      expect(result).not.toBeNull();
      expect(result?.testCases).toBeDefined();
      expect(result?.testCases).toHaveLength(2);
      expect(result?.testCases.every((tc) => tc.visibility === TestCaseVisibility.PUBLIC)).toBe(
        true,
      );
    });
  });

  describe('5.2 Languages Queries', () => {
    it('getEnabledLanguages returns only enabled languages and excludes disabled languages', async () => {
      const activeLanguages = await getEnabledLanguages(prisma);

      const slugs = activeLanguages.map((l) => l.slug);
      const activeLang = await prisma.language.findUniqueOrThrow({
        where: { id: testLangId },
      });
      const disabledLang = await prisma.language.findUniqueOrThrow({
        where: { id: disabledLangId },
      });

      expect(slugs).toContain(activeLang.slug);
      expect(slugs).not.toContain(disabledLang.slug);
      expect(activeLanguages.every((l) => l.isEnabled)).toBe(true);
    });
  });

  describe('5.3 Submissions & Complex Relational Joins', () => {
    it('getUserSubmissions returns submissions ordered newest first', async () => {
      const submissions = await getUserSubmissions(prisma, testUserId);

      expect(submissions.length).toBeGreaterThanOrEqual(1);
      expect(submissions[0]?.id).toBe(testSubmissionId);
    });

    it('getProblemSubmissions filters submissions by problemId', async () => {
      const problemSubmissions = await getProblemSubmissions(prisma, testProblemId);

      expect(problemSubmissions.length).toBeGreaterThanOrEqual(1);
      expect(problemSubmissions.every((s) => s.problemId === testProblemId)).toBe(true);
    });

    it('getSubmissionWithDetails returns deeply joined submission graph with test cases', async () => {
      const details = await getSubmissionWithDetails(prisma, testSubmissionId);

      expect(details).not.toBeNull();
      expect(details?.id).toBe(testSubmissionId);
      expect(details?.user.id).toBe(testUserId);
      expect(details?.problem.id).toBe(testProblemId);
      expect(details?.language.id).toBe(testLangId);
      expect(details?.testCaseResults).toHaveLength(2);

      // Verify each result correctly joins to its testCase
      for (const res of details!.testCaseResults) {
        expect(res.testCase).toBeDefined();
        expect(res.testCase.problemId).toBe(testProblemId);
        expect(res.verdict).toBe(Verdict.ACCEPTED);
      }
    });
  });
});
