import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';

describe('API Health and Readiness Endpoints', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
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

  it('GET /ready returns 200 and explicit readiness dependency checks', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('process');
    expect(res.body.checks.process.status).toBe('ok');
    // Ensure we do not fake postgres or redis as running
    expect(res.body.checks.postgres.status).toBe('not_implemented');
    expect(res.body.checks.redis.status).toBe('not_implemented');
  });

  it('GET /api/v1/ready returns 200 under versioned prefix', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.postgres.status).toBe('not_implemented');
  });
});
