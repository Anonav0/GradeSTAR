export { prisma, getPrismaClient, disconnectPrisma, checkDatabaseHealth } from './client.js';

export {
  PrismaClient,
  Prisma,
  UserRole,
  ProblemDifficulty,
  TestCaseVisibility,
  SubmissionStatus,
  Verdict,
  type User,
  type Problem,
  type Language,
  type TestCase,
  type Submission,
  type TestCaseResult,
} from '@prisma/client';
