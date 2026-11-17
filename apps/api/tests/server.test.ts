import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { startServer } from '../src/server.js';
import { validateEnv } from '../src/config/env.js';
import { createLogger } from '@gradestar/logging';

describe('Server Lifecycle and Graceful Shutdown', () => {
  const logger = createLogger({ serviceName: 'test-server', logLevel: 'silent' });

  it('starts HTTP server and handles requests, then shuts down cleanly', async () => {
    const onCloseSpy = vi.fn();
    const env = validateEnv({ API_PORT: '0', HOST: '127.0.0.1' });

    const instance = await startServer({
      env,
      logger,
      registerSignalHandlers: false,
      onClose: onCloseSpy,
    });

    expect(instance.server.listening).toBe(true);

    // Verify server can process HTTP traffic
    const res = await request(instance.server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    // Initiate graceful shutdown
    await instance.shutdown('SIGTERM');

    expect(instance.server.listening).toBe(false);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('disconnects backing resources by default when onClose is omitted', async () => {
    const env = validateEnv({ API_PORT: '0', HOST: '127.0.0.1' });
    const instance = await startServer({
      env,
      logger,
      registerSignalHandlers: false,
    });

    expect(instance.server.listening).toBe(true);
    await expect(instance.shutdown('SIGTERM')).resolves.not.toThrow();
    expect(instance.server.listening).toBe(false);
  });

  it('handles repeated shutdown calls idempotently without error', async () => {
    const onCloseSpy = vi.fn();
    const env = validateEnv({ API_PORT: '0', HOST: '127.0.0.1' });

    const instance = await startServer({
      env,
      logger,
      registerSignalHandlers: false,
      onClose: onCloseSpy,
    });

    await instance.shutdown('SIGTERM');
    // Repeated call with different or same signal
    await expect(instance.shutdown('SIGINT')).resolves.not.toThrow();

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects startup if port binding encounters an error', async () => {
    const env = validateEnv({ API_PORT: '0', HOST: '127.0.0.1' });
    const instance1 = await startServer({
      env,
      logger,
      registerSignalHandlers: false,
      onClose: () => {},
    });

    const boundAddress = instance1.server.address();
    const port = typeof boundAddress === 'object' && boundAddress ? boundAddress.port : 0;

    // Try to bind second server to the exact same port
    const duplicateEnv = validateEnv({ API_PORT: String(port), HOST: '127.0.0.1' });

    await expect(
      startServer({
        env: duplicateEnv,
        logger,
        registerSignalHandlers: false,
        onClose: () => {},
      }),
    ).rejects.toThrow();

    await instance1.shutdown();
  });

  it('fails fast on invalid environment configuration', async () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        // Missing DATABASE_URL in production
      }),
    ).toThrow('DATABASE_URL is required in production environment');
  });
});
