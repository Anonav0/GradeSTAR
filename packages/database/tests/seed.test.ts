import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, disconnectPrisma, TestCaseVisibility } from '../src/index.js';
import { seedDatabase } from '../src/seed.js';

describe('Database Seed Functionality', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('seeds canonical programming languages', async () => {
    const languages = await prisma.language.findMany();
    const slugs = languages.map((l) => l.slug);

    expect(slugs).toContain('cpp17');
    expect(slugs).toContain('python3');
    expect(slugs).toContain('java21');
    expect(languages.every((l) => l.isEnabled)).toBe(true);
  });

  it('seeds standard sample problems with public and hidden test cases', async () => {
    const problems = await prisma.problem.findMany({
      where: { slug: { in: ['two-sum', 'palindrome-check', 'fibonacci-number'] } },
      include: { testCases: { orderBy: { position: 'asc' } } },
    });

    const slugs = problems.map((p) => p.slug);
    expect(slugs).toContain('two-sum');
    expect(slugs).toContain('palindrome-check');
    expect(slugs).toContain('fibonacci-number');

    for (const problem of problems) {
      expect(problem.testCases.length).toBeGreaterThanOrEqual(3);

      const publicCases = problem.testCases.filter(
        (tc) => tc.visibility === TestCaseVisibility.PUBLIC,
      );
      const hiddenCases = problem.testCases.filter(
        (tc) => tc.visibility === TestCaseVisibility.HIDDEN,
      );

      expect(publicCases.length).toBeGreaterThan(0);
      expect(hiddenCases.length).toBeGreaterThan(0);
    }
  });

  it('is completely idempotent when executed multiple times', async () => {
    const initialLangCount = await prisma.language.count();
    const initialProbCount = await prisma.problem.count();
    const initialTcCount = await prisma.testCase.count();

    const secondRun = await seedDatabase();

    expect(secondRun.languagesCount).toBe(initialLangCount);
    expect(secondRun.problemsCount).toBe(initialProbCount);
    expect(secondRun.testCasesCount).toBe(initialTcCount);
  });
});
