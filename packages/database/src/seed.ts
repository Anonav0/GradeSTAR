import 'dotenv/config';
import { prisma, disconnectPrisma, ProblemDifficulty, TestCaseVisibility } from './index.js';

interface SeedLanguage {
  name: string;
  slug: string;
  version: string;
  isEnabled: boolean;
}

interface SeedTestCase {
  input: string;
  expectedOutput: string;
  visibility: TestCaseVisibility;
  position: number;
}

interface SeedProblem {
  slug: string;
  title: string;
  statement: string;
  difficulty: ProblemDifficulty;
  inputDescription: string;
  outputDescription: string;
  constraints: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  isPublished: boolean;
  testCases: SeedTestCase[];
}

const LANGUAGES: SeedLanguage[] = [
  {
    name: 'C++17',
    slug: 'cpp17',
    version: '17',
    isEnabled: true,
  },
  {
    name: 'Python 3',
    slug: 'python3',
    version: '3.11',
    isEnabled: true,
  },
  {
    name: 'Java 21',
    slug: 'java21',
    version: '21',
    isEnabled: true,
  },
];

const PROBLEMS: SeedProblem[] = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: ProblemDifficulty.EASY,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    isPublished: true,
    statement:
      'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nInput format:\nThe first line contains an integer N (number of elements).\nThe second line contains N space-separated integers.\nThe third line contains the target integer.\n\nOutput format:\nPrint the two 0-based indices separated by a space, sorted in ascending order.',
    inputDescription:
      'Line 1: Integer N (2 <= N <= 10^4).\nLine 2: N space-separated integers representing nums.\nLine 3: An integer target.',
    outputDescription:
      'Two space-separated integers representing the indices of the two numbers that sum to target, in ascending order.',
    constraints:
      '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
    testCases: [
      {
        position: 1,
        visibility: TestCaseVisibility.PUBLIC,
        input: '4\n2 7 11 15\n9\n',
        expectedOutput: '0 1\n',
      },
      {
        position: 2,
        visibility: TestCaseVisibility.PUBLIC,
        input: '3\n3 2 4\n6\n',
        expectedOutput: '1 2\n',
      },
      {
        position: 3,
        visibility: TestCaseVisibility.HIDDEN,
        input: '2\n3 3\n6\n',
        expectedOutput: '0 1\n',
      },
      {
        position: 4,
        visibility: TestCaseVisibility.HIDDEN,
        input: '5\n-1 -2 -3 -4 -5\n-8\n',
        expectedOutput: '2 4\n',
      },
    ],
  },
  {
    slug: 'palindrome-check',
    title: 'Palindrome Check',
    difficulty: ProblemDifficulty.EASY,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    isPublished: true,
    statement:
      'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string s, return true if it is a palindrome, or false otherwise.',
    inputDescription: 'A single line containing the string s.',
    outputDescription: "Print 'true' if the phrase is a palindrome, or 'false' otherwise.",
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    testCases: [
      {
        position: 1,
        visibility: TestCaseVisibility.PUBLIC,
        input: 'A man, a plan, a canal: Panama\n',
        expectedOutput: 'true\n',
      },
      {
        position: 2,
        visibility: TestCaseVisibility.PUBLIC,
        input: 'race a car\n',
        expectedOutput: 'false\n',
      },
      {
        position: 3,
        visibility: TestCaseVisibility.HIDDEN,
        input: ' \n',
        expectedOutput: 'true\n',
      },
      {
        position: 4,
        visibility: TestCaseVisibility.HIDDEN,
        input: '0P\n',
        expectedOutput: 'false\n',
      },
    ],
  },
  {
    slug: 'fibonacci-number',
    title: 'Fibonacci Number',
    difficulty: ProblemDifficulty.EASY,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    isPublished: true,
    statement:
      'The Fibonacci numbers, commonly denoted F(n), form a sequence where each number is the sum of the two preceding ones, starting from 0 and 1.\nThat is:\nF(0) = 0, F(1) = 1\nF(n) = F(n - 1) + F(n - 2), for n > 1.\n\nGiven an integer n, calculate F(n).',
    inputDescription: 'A single line containing the integer n.',
    outputDescription: 'Print a single integer representing F(n).',
    constraints: '0 <= n <= 30',
    testCases: [
      {
        position: 1,
        visibility: TestCaseVisibility.PUBLIC,
        input: '2\n',
        expectedOutput: '1\n',
      },
      {
        position: 2,
        visibility: TestCaseVisibility.PUBLIC,
        input: '3\n',
        expectedOutput: '2\n',
      },
      {
        position: 3,
        visibility: TestCaseVisibility.HIDDEN,
        input: '4\n',
        expectedOutput: '3\n',
      },
      {
        position: 4,
        visibility: TestCaseVisibility.HIDDEN,
        input: '10\n',
        expectedOutput: '55\n',
      },
    ],
  },
];

export async function seedDatabase(): Promise<{
  languagesCount: number;
  problemsCount: number;
  testCasesCount: number;
}> {
  // eslint-disable-next-line no-console
  console.log('Starting GradeSTAR database seeding...');

  // 1. Seed Languages (idempotent upsert by slug)
  for (const lang of LANGUAGES) {
    await prisma.language.upsert({
      where: { slug: lang.slug },
      update: {
        name: lang.name,
        version: lang.version,
        isEnabled: lang.isEnabled,
      },
      create: {
        name: lang.name,
        slug: lang.slug,
        version: lang.version,
        isEnabled: lang.isEnabled,
      },
    });
  }

  // 2. Seed Problems and Test Cases (idempotent upsert)
  for (const prob of PROBLEMS) {
    const problem = await prisma.problem.upsert({
      where: { slug: prob.slug },
      update: {
        title: prob.title,
        statement: prob.statement,
        difficulty: prob.difficulty,
        inputDescription: prob.inputDescription,
        outputDescription: prob.outputDescription,
        constraints: prob.constraints,
        timeLimitMs: prob.timeLimitMs,
        memoryLimitMb: prob.memoryLimitMb,
        isPublished: prob.isPublished,
      },
      create: {
        slug: prob.slug,
        title: prob.title,
        statement: prob.statement,
        difficulty: prob.difficulty,
        inputDescription: prob.inputDescription,
        outputDescription: prob.outputDescription,
        constraints: prob.constraints,
        timeLimitMs: prob.timeLimitMs,
        memoryLimitMb: prob.memoryLimitMb,
        isPublished: prob.isPublished,
      },
    });

    for (const tc of prob.testCases) {
      await prisma.testCase.upsert({
        where: {
          problemId_position: {
            problemId: problem.id,
            position: tc.position,
          },
        },
        update: {
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          visibility: tc.visibility,
        },
        create: {
          problemId: problem.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          visibility: tc.visibility,
          position: tc.position,
        },
      });
    }
  }

  const languagesCount = await prisma.language.count();
  const problemsCount = await prisma.problem.count();
  const testCasesCount = await prisma.testCase.count();

  // eslint-disable-next-line no-console
  console.log(
    `Seeding completed successfully: ${languagesCount} languages, ${problemsCount} problems, ${testCasesCount} test cases.`,
  );

  return { languagesCount, problemsCount, testCasesCount };
}

// Direct execution entrypoint
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await disconnectPrisma();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Database seeding failed:', error);
      await disconnectPrisma();
      process.exit(1);
    });
}
