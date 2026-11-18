import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createLogger, type Logger } from '@gradestar/logging';
import { requestIdMiddleware } from './middleware/request-id.js';
import { createRequestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createRootRouter, type RootRouterOptions } from './routes/index.js';

export interface AppOptions extends RootRouterOptions {
  logger?: Logger;
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

  // 1. Cross-origin resource sharing with credential support
  const rawCorsOrigin = options.corsOrigin || process.env['CORS_ORIGIN'];
  let corsOrigin: cors.CorsOptions['origin'];

  if (!rawCorsOrigin || rawCorsOrigin === '*') {
    // In local development, default to Next.js origin for cookie-based credentials
    corsOrigin = process.env['NODE_ENV'] === 'production' ? false : 'http://localhost:3000';
  } else if (rawCorsOrigin.includes(',')) {
    corsOrigin = rawCorsOrigin.split(',').map((s) => s.trim());
  } else {
    corsOrigin = rawCorsOrigin;
  }

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  // 2. Correlation Request ID middleware
  app.use(requestIdMiddleware);

  // 3. Structured HTTP request logging with header redaction
  app.use(createRequestLogger({ logger }));

  // 4. Cookie parser for session authentication
  app.use(cookieParser());

  // 5. Request body parsing with strict size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. Mount root and versioned routes (/health, /ready, /api/v1/*)
  app.use(createRootRouter(options));

  // 7. JSON 404 handler for unmatched routes
  app.use(notFoundHandler);

  // 8. Centralized error handling middleware
  app.use(createErrorHandler(logger));

  return app;
}
