import type { Router } from 'express';
import { createSystemRouter, type SystemRouterOptions } from './v1/system.routes.js';

export function createHealthRouter(options?: SystemRouterOptions): Router {
  return createSystemRouter(options);
}

export { createSystemRouter };
