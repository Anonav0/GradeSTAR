/**
 * Shared testing utilities and mocks for GradeSTAR.
 */

export function createMockEnvironment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    API_PORT: '4000',
    WORKER_PORT: '4001',
    LOG_LEVEL: 'silent',
    DATABASE_URL:
      'postgresql://gradestar:gradestar_dev_secret@localhost:5432/gradestar?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    ...overrides,
  };
}
