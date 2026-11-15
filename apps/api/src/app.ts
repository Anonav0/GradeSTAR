import express, { type Application } from 'express';
import cors from 'cors';
import { createLogger, type Logger } from '@gradestar/logging';
import { requestIdMiddleware } from './middleware/request-id.js';
import { createRequestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createRootRouter } from './routes/index.js';

export interface AppOptions {
  logger?: Logger;
  checkDbHealth?: () => Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
  dbTimeoutMs?: number;
  corsOrigin?: string;
}

/**
 * Express application factory.
 * Separated from server listener to facilitate unit/integration testing without port binding.
 */
export function createApp(options: AppOptions = {}): Application {
  const app = express();

  const logger =
    options.logger ??
    createLogger({
      serviceName: 'gradestar-api',
      isProduction: process.env['NODE_ENV'] === 'production',
      logLevel: process.env['LOG_LEVEL'] || 'info',
    });

  // 1. Cross-origin resource sharing
  app.use(
    cors({
      origin: options.corsOrigin || process.env['CORS_ORIGIN'] || '*',
    }),
  );

  // 2. Correlation Request ID middleware
  app.use(requestIdMiddleware);

  // 3. Structured HTTP request logging with header redaction
  app.use(createRequestLogger({ logger }));

  // 4. Request body parsing with strict size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5. Mount root and versioned routes (/health, /ready, /api/v1/*)
  app.use(
    createRootRouter({
      checkDbHealth: options.checkDbHealth,
      dbTimeoutMs: options.dbTimeoutMs,
    }),
  );

  // 6. JSON 404 handler for unmatched routes
  app.use(notFoundHandler);

  // 7. Centralized error handling middleware
  app.use(createErrorHandler(logger));

  return app;
}
