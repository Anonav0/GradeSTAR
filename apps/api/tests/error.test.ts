import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { createErrorHandler } from '../src/middleware/errorHandler.js';

describe('API Error Handling Middleware', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });

  it('handles malformed JSON body with 400 Bad Request', async () => {
    const app = createApp({ logger });
    const res = await request(app)
      .post('/health') // using existing route with malformed JSON
      .set('Content-Type', 'application/json')
      .send('{"badJson: true');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'BadRequest');
    expect(res.body).toHaveProperty('message', 'Malformed JSON payload in request body');
  });

  it('handles unexpected internal server errors safely', async () => {
    const app = express();
    app.get('/crash', () => {
      throw new Error('Database connection explosion');
    });
    app.use(createErrorHandler(logger));

    const res = await request(app).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'InternalServerError');
    expect(res.body).toHaveProperty('timestamp');
  });
});
