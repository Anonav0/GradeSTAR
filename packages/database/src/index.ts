export { prisma, getPrismaClient, disconnectPrisma, checkDatabaseHealth } from './client.js';

export {
  DatabaseErrorCode,
  type DatabaseErrorCodeType,
  type DatabaseErrorCategory,
  type ClassifiedDatabaseError,
  isPrismaKnownRequestError,
  isUniqueConstraintViolation,
  isForeignKeyViolation,
  isRecordNotFound,
  isCheckConstraintViolation,
  isTransactionConflict,
  classifyDatabaseError,
} from './errors.js';

export {
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
  type TransitionSubmissionParams,
  type TransitionResult,
  atomicTransitionSubmissionStatus,
  withTransaction,
} from './lifecycle.js';

export {
  SEED_LANGUAGES,
  SEED_PROBLEMS,
  type SeedLanguage,
  type SeedTestCase,
  type SeedProblem,
  type SeedSummary,
  validateDatabaseConfig,
  seedDatabase,
} from './seed.js';

export {
  type DbClient,
  type ProblemWithPublicTestCases,
  getPublishedProblemBySlug,
  getPublicTestCases,
  getEvaluationTestCases,
  getEnabledLanguages,
  getUserSubmissions,
  getProblemSubmissions,
  getSubmissionWithDetails,
} from './queries.js';

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
  type Session,
} from '@prisma/client';
