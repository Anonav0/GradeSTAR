/**
 * Standard API error response payload
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  service: string;
  environment: string;
}

/**
 * Readiness check dependency status
 */
export interface DependencyCheck {
  status: 'ok' | 'degraded' | 'unavailable' | 'not_implemented';
  message?: string;
  latencyMs?: number;
}

/**
 * Readiness check response
 */
export interface ReadyResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  service: string;
  checks: Record<string, DependencyCheck>;
}

/**
 * Domain Role Enum
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

/**
 * Problem Difficulty Enum
 */
export enum ProblemDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export type ProblemDifficultyValue = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Test Case Visibility Enum
 */
export enum TestCaseVisibility {
  PUBLIC = 'PUBLIC',
  HIDDEN = 'HIDDEN',
}

/**
 * Submission Lifecycle Status Enum
 */
export enum SubmissionStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Canonical GradeSTAR Evaluation Verdict Enum
 */
export enum Verdict {
  ACCEPTED = 'ACCEPTED',
  WRONG_ANSWER = 'WRONG_ANSWER',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  OUTPUT_LIMIT_EXCEEDED = 'OUTPUT_LIMIT_EXCEEDED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

/**
 * @deprecated Use SubmissionStatus and Verdict for clean separation of lifecycle and verdict
 */
export const SubmissionVerdict = {
  ...SubmissionStatus,
  ...Verdict,
} as const;

/**
 * Supported programming languages (to be expanded in subsequent phases)
 */
export type SupportedLanguageId = 'cpp17' | 'python3' | 'java21';

/**
 * Standard API success response envelope
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Problem list summary item for candidate discovery
 */
export interface ProblemListItem {
  slug: string;
  title: string;
  difficulty: ProblemDifficulty | ProblemDifficultyValue;
  createdAt: string | Date;
}

/**
 * Standard pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated problem listing payload
 */
export interface ProblemListResult {
  items: ProblemListItem[];
  pagination: PaginationMeta;
}

export type ProblemListResponse = ApiResponse<ProblemListResult>;

/**
 * Public sample test case visible to candidates
 */
export interface PublicSampleTestCase {
  input: string;
  expectedOutput: string;
  position: number;
}

/**
 * Detailed problem view for solving
 */
export interface ProblemDetail {
  slug: string;
  title: string;
  statement: string;
  difficulty: ProblemDifficulty | ProblemDifficultyValue;
  inputDescription: string;
  outputDescription: string;
  constraints: string | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  sampleTestCases: PublicSampleTestCase[];
}

export interface ProblemDetailResult {
  problem: ProblemDetail;
}

export type ProblemDetailResponse = ApiResponse<ProblemDetailResult>;

/**
 * Enabled programming language item
 */
export interface EnabledLanguageItem {
  name: string;
  slug: string;
  version: string;
}

export interface EnabledLanguagesResult {
  items: EnabledLanguageItem[];
}

export type LanguageListResponse = ApiResponse<EnabledLanguagesResult>;
