import express, { type Application } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from '@gradestar/logging';
import { createHealthRouter } from './routes/health.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { createErrorHandler } from './middleware/errorHandler.js';

export interface AppOptions {
  logger: Logger;
}

/**
 * Express application factory.
 * Separated from server listener to facilitate unit/integration testing without port binding.
 */
export function createApp(options: AppOptions): Application {
  const app = express();

  // Security and cross-origin handling
  app.use(cors());

  // Structured HTTP request logging
  app.use(
    pinoHttp({
      logger: options.logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/ready',
      },
    }),
  );

  // Request body parsing with strict size limits to prevent body-flooding DoS
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Health and readiness routes
  const healthRouter = createHealthRouter();
  app.use(healthRouter);
  app.use('/api/v1', healthRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(createErrorHandler(options.logger));

  return app;
}
