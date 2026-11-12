import 'dotenv/config';
import { createLogger } from '@gradestar/logging';
import { validateWorkerEnv } from './config/env.js';
import { WorkerService } from './worker.js';

const env = validateWorkerEnv();

const logger = createLogger({
  serviceName: 'gradestar-worker',
  logLevel: env.LOG_LEVEL,
  isProduction: env.NODE_ENV === 'production',
});

const workerService = new WorkerService({ env, logger });

await workerService.start();

async function handleShutdown(signal: string) {
  logger.info({ signal }, `Received ${signal}. Shutting down worker...`);
  await workerService.stop();
  process.exit(0);
}

process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
process.on('SIGINT', () => void handleShutdown('SIGINT'));
