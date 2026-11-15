import { z } from 'zod';

const portValidator = (name: string) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be a valid integer`)
    .transform(Number)
    .refine((port) => port >= 0 && port <= 65535, `${name} must be between 0 and 65535`);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    API_PORT: portValidator('API_PORT').optional(),
    PORT: portValidator('PORT').optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL').optional(),
    REDIS_URL: z
      .string()
      .url('REDIS_URL must be a valid connection URL')
      .default('redis://localhost:6379'),
    CORS_ORIGIN: z.string().default('*'),
  })
  .transform((data) => {
    const resolvedPort = data.PORT ?? data.API_PORT ?? 4000;
    let databaseUrl = data.DATABASE_URL;
    if (!databaseUrl && data.NODE_ENV !== 'production') {
      databaseUrl =
        'postgresql://gradestar:gradestar_dev_secret@localhost:5433/gradestar?schema=public';
    }
    return {
      ...data,
      API_PORT: resolvedPort,
      PORT: resolvedPort,
      port: resolvedPort,
      DATABASE_URL: databaseUrl as string,
    };
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production' && !data.DATABASE_URL) {
        return false;
      }
      return true;
    },
    {
      message: 'DATABASE_URL is required in production environment',
      path: ['DATABASE_URL'],
    },
  );

export type ApiEnv = z.infer<typeof envSchema>;

/**
 * Validates process.env or an input object against the Zod schema.
 * Throws a sanitized, formatted error if validation fails without leaking secrets.
 */
export function validateEnv(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ApiEnv {
  const result = envSchema.safeParse(environment);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`[GradeSTAR API] Invalid environment configuration:\n${formattedErrors}`);
  }
  return result.data;
}
