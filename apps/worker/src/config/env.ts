import { z } from 'zod';

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WORKER_CONCURRENCY: z
    .string()
    .regex(/^\d+$/, 'WORKER_CONCURRENCY must be an integer')
    .transform(Number)
    .default('2'),
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

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(environment: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(environment);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[GradeSTAR Worker] Invalid environment configuration:\n${formattedErrors}`);
  }
  return result.data;
}
