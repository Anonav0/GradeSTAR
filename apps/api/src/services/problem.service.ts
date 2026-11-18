import { type DbClient, type Prisma, TestCaseVisibility } from '@gradestar/database';
import type { ProblemListResult, ProblemDetailResult } from '@gradestar/shared';
import type { ListProblemsQuery } from '../schemas/problem.schema.js';

/**
 * Retrieves a paginated list of published problems with filtering and sorting.
 * Ensures unpublished problems, test cases, and internal fields are never retrieved.
 *
 * @param client Database client or transaction client
 * @param query Validated query options
 */
export async function listPublishedProblems(
  client: DbClient,
  query: ListProblemsQuery,
): Promise<ProblemListResult> {
  const { page, limit, difficulty, sortBy, sortOrder, q } = query;
  const skip = (page - 1) * limit;
  const take = limit;

  const where: Prisma.ProblemWhereInput = {
    isPublished: true,
    ...(difficulty ? { difficulty } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    client.problem.findMany({
      where,
      skip,
      take,
      orderBy: [{ [sortBy]: sortOrder }, { slug: 'asc' }],
      select: {
        slug: true,
        title: true,
        difficulty: true,
        createdAt: true,
      },
    }),
    client.problem.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Retrieves a published problem statement and public sample test cases by slug.
 * Hidden test cases and unpublished problems are filtered strictly at the database level.
 *
 * @param client Database client or transaction client
 * @param slug Unique problem slug
 */
export async function getPublishedProblemBySlug(
  client: DbClient,
  slug: string,
): Promise<ProblemDetailResult | null> {
  const problem = await client.problem.findFirst({
    where: {
      slug,
      isPublished: true,
    },
    select: {
      slug: true,
      title: true,
      statement: true,
      difficulty: true,
      inputDescription: true,
      outputDescription: true,
      constraints: true,
      timeLimitMs: true,
      memoryLimitMb: true,
      testCases: {
        where: {
          visibility: TestCaseVisibility.PUBLIC,
        },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: {
          input: true,
          expectedOutput: true,
          position: true,
        },
      },
    },
  });

  if (!problem) {
    return null;
  }

  const { testCases, ...problemData } = problem;

  return {
    problem: {
      ...problemData,
      sampleTestCases: testCases,
    },
  };
}
