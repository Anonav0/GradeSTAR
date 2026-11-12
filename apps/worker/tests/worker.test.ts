import { describe, it, expect } from 'vitest';
import { WorkerService } from '../src/worker.js';
import { validateWorkerEnv } from '../src/config/env.js';
import { createLogger } from '@gradestar/logging';

describe('Worker Service Lifecycle', () => {
  const logger = createLogger({ serviceName: 'test-worker', logLevel: 'silent' });
  const env = validateWorkerEnv({});

  it('starts and stops gracefully', async () => {
    const worker = new WorkerService({ env, logger });
    expect(worker.running).toBe(false);

    await worker.start();
    expect(worker.running).toBe(true);

    await worker.stop();
    expect(worker.running).toBe(false);
  });

  it('validates worker environment variables', () => {
    const custom = validateWorkerEnv({ WORKER_CONCURRENCY: '4' });
    expect(custom.WORKER_CONCURRENCY).toBe(4);

    expect(() => validateWorkerEnv({ WORKER_CONCURRENCY: 'invalid' })).toThrow(
      'WORKER_CONCURRENCY must be an integer',
    );
  });
});
