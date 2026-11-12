import 'dotenv/config';
import http from 'node:http';
import { createLogger } from '@gradestar/logging';
import { validateEnv } from './config/env.js';
import { createApp } from './app.js';

const env = validateEnv();

const logger = createLogger({
  serviceName: 'gradestar-api',
  logLevel: env.LOG_LEVEL,
  isProduction: env.NODE_ENV === 'production',
});

const app = createApp({ logger });
const server = http.createServer(app);

server.listen(env.API_PORT, () => {
  logger.info(
    { port: env.API_PORT, environment: env.NODE_ENV },
    `GradeSTAR API service listening on port ${env.API_PORT}`,
  );
});

// Graceful shutdown handling
function shutdown(signal: string) {
  logger.info({ signal }, `Received ${signal}. Initiating graceful shutdown of API server...`);

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during API server close');
      process.exit(1);
    }
    logger.info('API server closed successfully. Exiting.');
    process.exit(0);
  });

  // Force shutdown after timeout if connections fail to close
  setTimeout(() => {
    logger.error('Forced shutdown: pending connections timed out after 10s');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
