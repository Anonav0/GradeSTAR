import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma, type DbClient } from '@gradestar/database';
import { getEnabledLanguages } from '../../services/language.service.js';

export interface LanguageRouterOptions {
  db?: DbClient;
}

/**
 * Creates language discovery routes (/api/v1/languages/*).
 * All endpoints are public and read-only.
 */
export function createLanguageRouter(options: LanguageRouterOptions = {}): Router {
  const router = Router();
  const db = options.db ?? prisma;

  /**
   * GET /api/v1/languages
   * Lists enabled programming languages supported for submissions.
   */
  router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await getEnabledLanguages(db);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
