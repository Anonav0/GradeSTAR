import type { Logger } from '@gradestar/logging';
import type { WorkerEnv } from './config/env.js';

export interface WorkerServiceOptions {
  env: WorkerEnv;
  logger: Logger;
}

export class WorkerService {
  private readonly env: WorkerEnv;
  private readonly logger: Logger;
  private isRunning = false;
  private keepAliveTimer?: NodeJS.Timeout;

  constructor(options: WorkerServiceOptions) {
    this.env = options.env;
    this.logger = options.logger;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('WorkerService is already running');
      return;
    }

    this.logger.info(
      {
        concurrency: this.env.WORKER_CONCURRENCY,
        environment: this.env.NODE_ENV,
      },
      'WorkerService initialized. Waiting for Phase 4 BullMQ queue integration.',
    );

    this.isRunning = true;
    // Keep worker event loop alive while awaiting Phase 4 BullMQ integration
    this.keepAliveTimer = setInterval(() => {}, 1 << 30);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping WorkerService and draining active tasks...');
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
    this.isRunning = false;
    this.logger.info('WorkerService stopped cleanly.');
  }

  public get running(): boolean {
    return this.isRunning;
  }
}
