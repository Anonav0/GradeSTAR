import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import { AppError } from '../src/errors/app-error.js';
import { requestIdMiddleware } from '../src/middleware/request-id.js';

describe('API Error Handling Middleware', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });

  it('handles malformed JSON body with 400 Bad Request and preserves requestId', async () => {
    const app = createApp({ logger });
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .set('X-Request-Id', 'client-req-123')
      .send('{"badJson: true');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'BadRequest');
    expect(res.body).toHaveProperty('message', 'Malformed JSON payload in request body');
    expect(res.body).toHaveProperty('requestId', 'client-req-123');
    expect(res.headers['x-request-id']).toBe('client-req-123');
  });

  it('handles AppError instances with designated statusCode and code', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/not-found-item', () => {
      throw AppError.notFound('Problem slug binary-search not found', 'PROBLEM_NOT_FOUND');
    });
    app.get('/conflict-item', () => {
      throw AppError.conflict('Submission already running', 'SUBMISSION_LOCKED', {
        submissionId: '123',
      });
    });
    app.use(createErrorHandler(logger));

    const res404 = await request(app).get('/not-found-item');
    expect(res404.status).toBe(404);
    expect(res404.body.error).toBe('PROBLEM_NOT_FOUND');
    expect(res404.body.message).toBe('Problem slug binary-search not found');
    expect(res404.body.requestId).toBeDefined();

    const res409 = await request(app).get('/conflict-item');
    expect(res409.status).toBe(409);
    expect(res409.body.error).toBe('SUBMISSION_LOCKED');
    expect(res409.body.details).toEqual({ submissionId: '123' });
  });

  it('handles unexpected internal server errors safely in non-production mode', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/crash', () => {
      throw new Error('Database connection explosion');
    });
    app.use(createErrorHandler(logger));

    const res = await request(app).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'InternalServerError');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('requestId');
  });

  it('sanitizes unexpected internal error messages in production mode', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    try {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/crash', () => {
        throw new Error('Sensitive database credentials leak in error message');
      });
      app.use(createErrorHandler(logger));

      const res = await request(app).get('/crash');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('InternalServerError');
      expect(res.body.message).toBe('An unexpected internal error occurred');
      expect(res.body.message).not.toContain('credentials');
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('delegates to next if response headers were already sent', () => {
    const handler = createErrorHandler(logger);
    const req = { id: 'req-1' } as Request;
    const res = { headersSent: true } as Response;
    const next = vi.fn();
    const testErr = new Error('Test stream failure');

    handler(testErr, req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(testErr);
  });
});
