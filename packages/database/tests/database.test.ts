import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  disconnectPrisma,
  checkDatabaseHealth,
  UserRole,
  ProblemDifficulty,
  TestCaseVisibility,
  SubmissionStatus,
  Verdict,
  Prisma,
} from '../src/index.js';

describe('Database Models & Relational Constraints Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any test records from prior runs
    await prisma.testCaseResult.deleteMany({
      where: { submission: { user: { email: { startsWith: 'test-user-' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { email: { startsWith: 'test-user-' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-user-' } },
    });
    await prisma.problem.deleteMany({
      where: { slug: { startsWith: 'test-problem-' } },
    });
    await prisma.language.deleteMany({
      where: { slug: { startsWith: 'test-lang-' } },
    });
  });

  afterAll(async () => {
    await prisma.testCaseResult.deleteMany({
      where: { submission: { user: { email: { startsWith: 'test-user-' } } } },
    });
    await prisma.submission.deleteMany({
      where: { user: { email: { startsWith: 'test-user-' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-user-' } },
    });
    await prisma.problem.deleteMany({
      where: { slug: { startsWith: 'test-problem-' } },
    });
    await prisma.language.deleteMany({
      where: { slug: { startsWith: 'test-lang-' } },
    });
    await disconnectPrisma();
  });

  it('performs live database health check successfully', async () => {
    const health = await checkDatabaseHealth();
    expect(health.ok).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
  });

  it('enforces User uniqueness on email address', async () => {
    const email = `test-user-${Date.now()}@gradestar.dev`;

    const user1 = await prisma.user.create({
      data: {
        name: 'Test Student',
        email,
        role: UserRole.USER,
      },
    });
    expect(user1.id).toBeDefined();

    // Attempting to create duplicate user with same email must fail
    await expect(
      prisma.user.create({
        data: {
          name: 'Imposter Student',
          email,
          role: UserRole.USER,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('enforces Problem uniqueness on slug', async () => {
    const slug = `test-problem-${Date.now()}`;

    const problem1 = await prisma.problem.create({
      data: {
        slug,
        title: 'Slug Collision Test',
        statement: 'Statement text',
        inputDescription: 'Input format',
        outputDescription: 'Output format',
        difficulty: ProblemDifficulty.MEDIUM,
        timeLimitMs: 1500,
        memoryLimitMb: 512,
      },
    });
    expect(problem1.id).toBeDefined();

    // Duplicate slug must fail
    await expect(
      prisma.problem.create({
        data: {
          slug,
          title: 'Another Problem with Same Slug',
          statement: 'Other statement',
          inputDescription: 'Input',
          outputDescription: 'Output',
          difficulty: ProblemDifficulty.HARD,
          timeLimitMs: 2000,
          memoryLimitMb: 512,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('enforces TestCase position uniqueness within a problem', async () => {
    const problem = await prisma.problem.create({
      data: {
        slug: `test-problem-tc-${Date.now()}`,
        title: 'Test Cases Problem',
        statement: 'Statement',
        inputDescription: 'In',
        outputDescription: 'Out',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      },
    });

    // Create position 1
    await prisma.testCase.create({
      data: {
        problemId: problem.id,
        position: 1,
        input: '1\n',
        expectedOutput: '1\n',
        visibility: TestCaseVisibility.PUBLIC,
      },
    });

    // Duplicate position 1 for same problem must fail
    await expect(
      prisma.testCase.create({
        data: {
          problemId: problem.id,
          position: 1,
          input: '2\n',
          expectedOutput: '2\n',
          visibility: TestCaseVisibility.HIDDEN,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('cascades deletion from Problem to associated TestCases', async () => {
    const problem = await prisma.problem.create({
      data: {
        slug: `test-problem-cascade-${Date.now()}`,
        title: 'Cascade Problem',
        statement: 'Statement',
        inputDescription: 'In',
        outputDescription: 'Out',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        testCases: {
          create: [
            { position: 1, input: 'a\n', expectedOutput: 'a\n' },
            { position: 2, input: 'b\n', expectedOutput: 'b\n' },
          ],
        },
      },
    });

    const testCaseCount = await prisma.testCase.count({
      where: { problemId: problem.id },
    });
    expect(testCaseCount).toBe(2);

    // Delete problem
    await prisma.problem.delete({ where: { id: problem.id } });

    // Test cases should be cascade deleted
    const remainingCases = await prisma.testCase.count({
      where: { problemId: problem.id },
    });
    expect(remainingCases).toBe(0);
  });

  it('creates Submissions with default PENDING status and null verdict', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Submission User',
        email: `test-user-sub-${Date.now()}@gradestar.dev`,
      },
    });

    const problem = await prisma.problem.create({
      data: {
        slug: `test-problem-sub-${Date.now()}`,
        title: 'Submission Test Problem',
        statement: 'Statement',
        inputDescription: 'In',
        outputDescription: 'Out',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      },
    });

    const lang = await prisma.language.findFirstOrThrow({
      where: { slug: 'python3' },
    });

    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        languageId: lang.id,
        sourceCode: 'print("hello world")',
      },
    });

    expect(submission.status).toBe(SubmissionStatus.PENDING);
    expect(submission.verdict).toBeNull();
    expect(submission.startedAt).toBeNull();
    expect(submission.completedAt).toBeNull();
  });

  it('enforces uniqueness on TestCaseResult (submissionId, testCaseId)', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Result User',
        email: `test-user-res-${Date.now()}@gradestar.dev`,
      },
    });

    const problem = await prisma.problem.create({
      data: {
        slug: `test-problem-res-${Date.now()}`,
        title: 'Result Test Problem',
        statement: 'Statement',
        inputDescription: 'In',
        outputDescription: 'Out',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
        testCases: {
          create: [{ position: 1, input: '1\n', expectedOutput: '1\n' }],
        },
      },
      include: { testCases: true },
    });

    const testCase = problem.testCases[0]!;
    const lang = await prisma.language.findFirstOrThrow({
      where: { slug: 'python3' },
    });

    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        languageId: lang.id,
        sourceCode: 'print(1)',
      },
    });

    // Create first test case result
    await prisma.testCaseResult.create({
      data: {
        submissionId: submission.id,
        testCaseId: testCase.id,
        verdict: Verdict.ACCEPTED,
        executionTimeMs: 45,
        memoryUsedKb: 12400,
        stdout: '1\n',
      },
    });

    // Attempting duplicate result for the same (submissionId, testCaseId) must fail
    await expect(
      prisma.testCaseResult.create({
        data: {
          submissionId: submission.id,
          testCaseId: testCase.id,
          verdict: Verdict.WRONG_ANSWER,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('restricts User deletion if User has historical Submissions (onDelete: Restrict)', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Immutable History User',
        email: `test-user-restrict-${Date.now()}@gradestar.dev`,
      },
    });

    const problem = await prisma.problem.create({
      data: {
        slug: `test-problem-restrict-${Date.now()}`,
        title: 'Restrict Problem',
        statement: 'Statement',
        inputDescription: 'In',
        outputDescription: 'Out',
        difficulty: ProblemDifficulty.EASY,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      },
    });

    const lang = await prisma.language.findFirstOrThrow({
      where: { slug: 'python3' },
    });

    await prisma.submission.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        languageId: lang.id,
        sourceCode: 'pass',
      },
    });

    // Attempting to delete user must be restricted by foreign key constraint
    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });
});
