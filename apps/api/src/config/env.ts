import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z
    .string()
    .regex(/^\d+$/, 'API_PORT must be a valid integer')
    .transform(Number)
    .default('4000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid connection URL')
    .default('postgresql://gradestar:gradestar_dev_secret@localhost:5432/gradestar?schema=public'),
  REDIS_URL: z
    .string()
    .url('REDIS_URL must be a valid connection URL')
    .default('redis://localhost:6379'),
});

export type ApiEnv = z.infer<typeof envSchema>;

/**
 * Validates process.env against the Zod schema.
 * Throws a formatted error if validation fails.
 */
export function validateEnv(environment: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = envSchema.safeParse(environment);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[GradeSTAR API] Invalid environment configuration:\n${formattedErrors}`);
  }
  return result.data;
}
