import { Router, type Request, type Response } from 'express';
import type { HealthResponse, ReadyResponse } from '@gradestar/shared';

export function createHealthRouter(): Router {
  const router = Router();
  const startTime = Date.now();

  /**
   * Liveness probe: returns 200 OK if the API process is alive.
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
   * Readiness probe: reports readiness based on the dependencies actually implemented.
   * In Phase 1, PostgreSQL and Redis connections are not yet integrated into the API service.
   * We report process state accurately without pretending external services are connected.
   */
  router.get('/ready', (_req: Request, res: Response) => {
    const checks: ReadyResponse['checks'] = {
      process: {
        status: 'ok',
        message: 'API process is initialized and ready to accept HTTP traffic',
      },
      postgres: {
        status: 'not_implemented',
        message: 'Database persistence layer is planned for Phase 2',
      },
      redis: {
        status: 'not_implemented',
        message: 'Redis queue connection is planned for Phase 4',
      },
    };

    // Overall readiness is ready for Phase 1 scope (HTTP operational)
    const response: ReadyResponse = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      service: 'gradestar-api',
      checks,
    };

    res.status(200).json(response);
  });

  return router;
}
