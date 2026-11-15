import { Router } from 'express';
import { createSystemRouter, type SystemRouterOptions } from './v1/system.routes.js';
import { createV1Router, type V1RouterOptions } from './v1/index.js';

export interface RootRouterOptions extends SystemRouterOptions, V1RouterOptions {}

/**
 * Root router for GradeSTAR API.
 * Mounts unversioned health/ready endpoints and versioned sub-routers.
 */
export function createRootRouter(options: RootRouterOptions = {}): Router {
  const router = Router();

  // Root-level health endpoints: /health, /ready
  router.use(createSystemRouter(options));

  // Version 1 API router: /api/v1/*
  router.use('/api/v1', createV1Router(options));

  return router;
}

export { createSystemRouter } from './v1/system.routes.js';
export { createV1Router } from './v1/index.js';
