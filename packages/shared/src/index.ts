/**
 * Standard API error response payload
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
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
 * Canonical GradeSTAR submission verdicts
 */
export enum SubmissionVerdict {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  ACCEPTED = 'ACCEPTED',
  WRONG_ANSWER = 'WRONG_ANSWER',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  OUTPUT_LIMIT_EXCEEDED = 'OUTPUT_LIMIT_EXCEEDED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CANCELLED = 'CANCELLED',
}

/**
 * Supported programming languages (to be expanded in subsequent phases)
 */
export type SupportedLanguageId = 'cpp17' | 'python3' | 'java21';
