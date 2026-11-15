import {
  Prisma,
  PrismaClient,
  Problem,
  Language,
  TestCase,
  Submission,
  SubmissionStatus,
  TestCaseVisibility,
} from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Public problem representation with public test cases for display to candidates.
 */
export interface ProblemWithPublicTestCases extends Problem {
  testCases: TestCase[];
}

/**
 * Retrieves a published problem by its unique slug.
 * Returns null if the problem does not exist or is unpublished.
 *
 * @param client Database client or transaction client
 * @param slug Unique problem slug
 * @param options.includePublicTestCases If true, joins public test cases ordered by position
 */
export async function getPublishedProblemBySlug(
  client: DbClient,
  slug: string,
  options?: { includePublicTestCases?: boolean },
): Promise<Problem | ProblemWithPublicTestCases | null> {
  return client.problem.findFirst({
    where: {
      slug,
      isPublished: true,
    },
    include: options?.includePublicTestCases
      ? {
          testCases: {
            where: { visibility: TestCaseVisibility.PUBLIC },
            orderBy: { position: 'asc' },
          },
        }
      : undefined,
  });
}

/**
 * Retrieves ONLY public test cases for a problem, strictly ordered by position ascending.
 * Explicitly excludes hidden test cases to protect evaluation inputs from exposure in public contexts.
 */
export async function getPublicTestCases(client: DbClient, problemId: string): Promise<TestCase[]> {
  return client.testCase.findMany({
    where: {
      problemId,
      visibility: TestCaseVisibility.PUBLIC,
    },
    orderBy: {
      position: 'asc',
    },
  });
}

/**
 * Retrieves ALL test cases (both PUBLIC and HIDDEN) for a problem, ordered by position ascending.
 * Intended EXCLUSIVELY for trusted evaluator/worker services during execution.
 */
export async function getEvaluationTestCases(
  client: DbClient,
  problemId: string,
): Promise<TestCase[]> {
  return client.testCase.findMany({
    where: {
      problemId,
    },
    orderBy: {
      position: 'asc',
    },
  });
}

/**
 * Retrieves all enabled programming languages, sorted by name ascending.
 * Disabled languages are excluded.
 */
export async function getEnabledLanguages(client: DbClient): Promise<Language[]> {
  return client.language.findMany({
    where: {
      isEnabled: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
}

/**
 * Retrieves submissions for a user, ordered by creation time (newest first).
 */
export async function getUserSubmissions(
  client: DbClient,
  userId: string,
  options?: { limit?: number; problemId?: string; status?: SubmissionStatus },
): Promise<Submission[]> {
  return client.submission.findMany({
    where: {
      userId,
      ...(options?.problemId ? { problemId: options.problemId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit,
  });
}

/**
 * Retrieves submissions for a specific problem.
 */
export async function getProblemSubmissions(
  client: DbClient,
  problemId: string,
  options?: { limit?: number; status?: SubmissionStatus },
): Promise<Submission[]> {
  return client.submission.findMany({
    where: {
      problemId,
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit,
  });
}

/**
 * Retrieves a submission by ID with its problem, language, user reference,
 * and test case results joined with their corresponding test cases.
 */
export async function getSubmissionWithDetails(client: DbClient, submissionId: string) {
  return client.submission.findUnique({
    where: { id: submissionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      problem: true,
      language: true,
      testCaseResults: {
        include: {
          testCase: true,
        },
        orderBy: {
          testCase: {
            position: 'asc',
          },
        },
      },
    },
  });
}
