import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';

describe('API Health and Readiness Endpoints', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });

  describe('Liveness probe (/health)', () => {
    const app = createApp({ logger });

    it('GET /health returns 200 and process liveness status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('service', 'gradestar-api');
      expect(res.body).toHaveProperty('timestamp');
      expect(typeof res.body.uptimeSeconds).toBe('number');
    });

    it('GET /api/v1/health returns 200 under versioned prefix', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });

    it('GET /health succeeds even if database is unavailable', async () => {
      const appWithBrokenDb = createApp({
        logger,
        checkDbHealth: async () => ({ ok: false, latencyMs: 10, error: 'Connection refused' }),
      });
      const res = await request(appWithBrokenDb).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Readiness probe (/ready)', () => {
    it('GET /ready returns 200 when PostgreSQL is healthy', async () => {
      const app = createApp({
        logger,
        checkDbHealth: async () => ({ ok: true, latencyMs: 4 }),
      });

      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ready');
      expect(res.body.checks.process.status).toBe('ok');
      expect(res.body.checks.postgres.status).toBe('ok');
      expect(typeof res.body.checks.postgres.latencyMs).toBe('number');
      expect(res.body.checks.redis.status).toBe('not_implemented');
    });

    it('GET /api/v1/ready returns 200 under versioned prefix when healthy', async () => {
      const app = createApp({
        logger,
        checkDbHealth: async () => ({ ok: true, latencyMs: 3 }),
      });

      const res = await request(app).get('/api/v1/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.postgres.status).toBe('ok');
    });

    it('GET /ready returns 503 when PostgreSQL is unavailable', async () => {
      const app = createApp({
        logger,
        checkDbHealth: async () => ({
          ok: false,
          latencyMs: 15,
          error: 'Connection terminated unexpectedly',
        }),
      });

      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.postgres.status).toBe('unavailable');
      expect(res.body.checks.postgres.message).toBe(
        'PostgreSQL database connectivity check failed',
      );
      // Ensure no raw error details or connection strings leaked
      expect(JSON.stringify(res.body)).not.toContain('Connection terminated unexpectedly');
      expect(JSON.stringify(res.body)).not.toContain('postgresql://');
    });

    it('GET /ready returns 503 when database health check times out', async () => {
      const app = createApp({
        logger,
        dbTimeoutMs: 50,
        checkDbHealth: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { ok: true, latencyMs: 200 };
        },
      });

      const res = await request(app).get('/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.checks.postgres.status).toBe('unavailable');
    });

    it('GET /ready integrates successfully with real PostgreSQL database', async () => {
      const app = createApp({ logger });
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.postgres.status).toBe('ok');
    });
  });
});
