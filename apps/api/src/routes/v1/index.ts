import { Router } from 'express';
import { createSystemRouter, type SystemRouterOptions } from './system.routes.js';

export type V1RouterOptions = SystemRouterOptions;

/**
 * Express router for API version 1 (/api/v1).
 * Mounts system routes and provides extension points for subsequent phases.
 */
export function createV1Router(options: V1RouterOptions = {}): Router {
  const router = Router();

  // System endpoints: /api/v1/health, /api/v1/ready
  router.use(createSystemRouter(options));

  return router;
}
