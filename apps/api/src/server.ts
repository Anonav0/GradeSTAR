import http from 'node:http';
import type { Application } from 'express';
import { createLogger, type Logger } from '@gradestar/logging';
import { disconnectPrisma } from '@gradestar/database';
import { createApp } from './app.js';
import { validateEnv, type ApiEnv } from './config/env.js';

export interface ServerInstance {
  server: http.Server;
  shutdown: (signal?: string) => Promise<void>;
  port: number;
}

export interface StartServerOptions {
  env?: ApiEnv;
  logger?: Logger;
  app?: Application;
  onClose?: () => Promise<void> | void;
  registerSignalHandlers?: boolean;
}

/**
 * Starts the GradeSTAR HTTP API server and registers graceful shutdown handlers.
 */
export async function startServer(options: StartServerOptions = {}): Promise<ServerInstance> {
  const env = options.env ?? validateEnv();
  const logger =
    options.logger ??
    createLogger({
      serviceName: 'gradestar-api',
      logLevel: env.LOG_LEVEL,
      isProduction: env.NODE_ENV === 'production',
    });

  const app = options.app ?? createApp({ logger });
  const server = http.createServer(app);

  let isShuttingDown = false;

  const shutdown = async (signal = 'SIGTERM'): Promise<void> => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    isShuttingDown = true;
    logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown of API server...`);

    const forceExitTimer = setTimeout(() => {
      logger.error('Forced shutdown: pending connections timed out after 10s');
      if (options.registerSignalHandlers !== false) {
        process.exit(1);
      }
    }, 10000);
    forceExitTimer.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed successfully');

      if (options.onClose) {
        await options.onClose();
      } else {
        await disconnectPrisma();
      }
      logger.info('Backing resources closed cleanly');
    } catch (err) {
      logger.error({ err }, 'Error during API server graceful shutdown');
      clearTimeout(forceExitTimer);
      throw err;
    } finally {
      clearTimeout(forceExitTimer);
    }
  };

  if (options.registerSignalHandlers !== false) {
    const handleSigterm = () => {
      shutdown('SIGTERM')
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    };
    const handleSigint = () => {
      shutdown('SIGINT')
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    };

    process.once('SIGTERM', handleSigterm);
    process.once('SIGINT', handleSigint);
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', (err) => {
      logger.error({ err }, 'Failed to bind server port');
      reject(err);
    });

    server.listen(env.port, env.HOST, () => {
      logger.info(
        { port: env.port, host: env.HOST, environment: env.NODE_ENV },
        `GradeSTAR API service listening on http://${env.HOST}:${env.port}`,
      );
      resolve();
    });
  });

  return {
    server,
    shutdown,
    port: env.port,
  };
}
