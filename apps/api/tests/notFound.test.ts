import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';

describe('API 404 Handler', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  it('returns 404 with structured ApiErrorResponse for unknown route', async () => {
    const res = await request(app).get('/unknown-nonexistent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      error: 'NotFound',
      message: 'Cannot GET /unknown-nonexistent-endpoint',
      timestamp: expect.any(String),
    });
  });
});
