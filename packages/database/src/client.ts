import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

declare global {
  var __gradestar_prisma__: PrismaClient | undefined;
}

/**
 * Creates or retrieves the singleton PrismaClient instance.
 * In development, reuses the instance attached to globalThis to prevent connection pool exhaustion during hot reload.
 */
export function getPrismaClient(): PrismaClient {
  if (process.env['NODE_ENV'] === 'production') {
    return new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  if (!globalThis.__gradestar_prisma__) {
    globalThis.__gradestar_prisma__ = new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  return globalThis.__gradestar_prisma__;
}

/**
 * Singleton database client instance for use throughout backend services.
 */
export const prisma = getPrismaClient();

/**
 * Gracefully disconnects the Prisma client from the database.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Executes a lightweight liveness check query against PostgreSQL.
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
