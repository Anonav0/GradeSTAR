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
