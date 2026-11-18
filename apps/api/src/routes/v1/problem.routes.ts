import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma, type DbClient } from '@gradestar/database';
import { validateRequest } from '../../middleware/validate-request.js';
import {
  listProblemsQuerySchema,
  problemSlugParamSchema,
  type ListProblemsQuery,
  type ProblemSlugParam,
} from '../../schemas/problem.schema.js';
import {
  listPublishedProblems,
  getPublishedProblemBySlug,
} from '../../services/problem.service.js';
import { AppError } from '../../errors/app-error.js';

export interface ProblemRouterOptions {
  db?: DbClient;
}

/**
 * Creates problem discovery and inspection routes (/api/v1/problems/*).
 * All endpoints are public and read-only.
 */
export function createProblemRouter(options: ProblemRouterOptions = {}): Router {
  const router = Router();
  const db = options.db ?? prisma;

  /**
   * GET /api/v1/problems
   * Lists published problems with pagination, filtering, and deterministic sorting.
   */
  router.get(
    '/',
    validateRequest({ query: listProblemsQuerySchema }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const query = (req.validated?.query ?? req.query) as ListProblemsQuery;
        const result = await listPublishedProblems(db, query);

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/problems/:slug
   * Retrieves a published problem statement and its public sample test cases.
   * Unpublished problems and nonexistent problems return the exact same 404 response.
   */
  router.get(
    '/:slug',
    validateRequest({ params: problemSlugParamSchema }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { slug } = (req.validated?.params ?? req.params) as ProblemSlugParam;
        const result = await getPublishedProblemBySlug(db, slug);

        if (!result) {
          throw AppError.notFound('Problem not found', 'PROBLEM_NOT_FOUND');
        }

        res.status(200).json({
          success: true,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
