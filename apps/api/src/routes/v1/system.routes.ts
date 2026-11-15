import { Router, type Request, type Response } from 'express';
import type { HealthResponse, ReadyResponse, DependencyCheck } from '@gradestar/shared';
import { checkDatabaseHealth } from '@gradestar/database';

export interface SystemRouterOptions {
  checkDbHealth?: () => Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
  dbTimeoutMs?: number;
}

/**
 * Creates system liveness and readiness inspection routes.
 */
export function createSystemRouter(options: SystemRouterOptions = {}): Router {
  const router = Router();
  const startTime = Date.now();
  const dbHealthFn = options.checkDbHealth ?? checkDatabaseHealth;
  const timeoutMs = options.dbTimeoutMs ?? 3000;

  /**
   * Liveness probe: returns 200 OK as long as the Node.js API process is responsive.
   * Does not depend on external backing services (PostgreSQL, Redis).
   */
  router.get('/health', (_req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      service: 'gradestar-api',
      environment: process.env['NODE_ENV'] || 'development',
    };

    res.status(200).json(response);
  });

  /**
   * Readiness probe: checks backing dependencies required by current API operations.
   * Checks PostgreSQL via bounded query execution. Returns 503 if unavailable.
   */
  router.get('/ready', async (_req: Request, res: Response) => {
    let postgresCheck: DependencyCheck;

    try {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<{ ok: boolean; latencyMs?: number; error?: string }>(
        (_, reject) => {
          timer = setTimeout(
            () => reject(new Error('PostgreSQL readiness check timed out')),
            timeoutMs,
          );
        },
      );

      const dbResult = await Promise.race([
        dbHealthFn().finally(() => clearTimeout(timer)),
        timeoutPromise,
      ]);

      if (dbResult.ok) {
        postgresCheck = {
          status: 'ok',
          latencyMs: dbResult.latencyMs,
        };
      } else {
        postgresCheck = {
          status: 'unavailable',
          message: 'PostgreSQL database connectivity check failed',
        };
      }
    } catch {
      postgresCheck = {
        status: 'unavailable',
        message: 'PostgreSQL database connectivity check failed',
      };
    }

    const isReady = postgresCheck.status === 'ok';

    const checks: ReadyResponse['checks'] = {
      process: {
        status: 'ok',
        message: 'API process is initialized and ready to accept HTTP traffic',
      },
      postgres: postgresCheck,
      redis: {
        status: 'not_implemented',
        message: 'Redis queue connection is planned for Phase 4',
      },
    };

    const response: ReadyResponse = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'gradestar-api',
      checks,
    };

    res.status(isReady ? 200 : 503).json(response);
  });

  return router;
}
