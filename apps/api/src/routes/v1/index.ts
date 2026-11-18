import { Router, type Request, type Response } from 'express';
import { UserRole } from '@gradestar/database';
import { createSystemRouter, type SystemRouterOptions } from './system.routes.js';
import { createAuthRouter, type AuthRouterOptions } from './auth.routes.js';
import { createProblemRouter, type ProblemRouterOptions } from './problem.routes.js';
import { createLanguageRouter, type LanguageRouterOptions } from './language.routes.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, requireOwnership } from '../../middleware/authorize.js';
import { validateCsrf } from '../../middleware/csrf.js';

export interface V1RouterOptions
  extends SystemRouterOptions, AuthRouterOptions, ProblemRouterOptions, LanguageRouterOptions {
  includeTestRoutes?: boolean;
}

/**
 * Express router for API version 1 (/api/v1).
 * Mounts system, authentication, problem discovery, and language endpoints.
 */
export function createV1Router(options: V1RouterOptions = {}): Router {
  const router = Router();

  // System endpoints: /api/v1/health, /api/v1/ready
  router.use(createSystemRouter(options));

  // Authentication endpoints: /api/v1/auth/*
  router.use('/auth', createAuthRouter(options));

  // Problem discovery endpoints: /api/v1/problems/*
  router.use('/problems', createProblemRouter(options));

  // Language discovery endpoints: /api/v1/languages/*
  router.use('/languages', createLanguageRouter(options));

  // Test-only authorization and ownership endpoints (never mounted in production)
  const shouldMountTestRoutes = options.includeTestRoutes ?? process.env['NODE_ENV'] === 'test';

  if (shouldMountTestRoutes) {
    const testRouter = Router();

    // Role-based authorization test route (ADMIN required)
    testRouter.get(
      '/admin-only',
      authenticate,
      requireRole(UserRole.ADMIN),
      (_req: Request, res: Response) => {
        res.status(200).json({ message: 'admin access granted' });
      },
    );

    // Multi-role authorized test route (USER or ADMIN)
    testRouter.get(
      '/user-or-admin',
      authenticate,
      requireRole(UserRole.USER, UserRole.ADMIN),
      (_req: Request, res: Response) => {
        res.status(200).json({ message: 'authorized' });
      },
    );

    // Ownership-protected test route
    testRouter.get(
      '/resources/:ownerId',
      authenticate,
      requireOwnership((req) => req.params['ownerId'] ?? null),
      (req: Request, res: Response) => {
        res.status(200).json({
          ownerId: req.params['ownerId'],
          accessedBy: req.user?.id,
        });
      },
    );

    // CSRF verification test route
    testRouter.post(
      '/protected-action',
      authenticate,
      validateCsrf,
      (_req: Request, res: Response) => {
        res.status(200).json({ success: true });
      },
    );

    router.use('/test', testRouter);
  }

  return router;
}
