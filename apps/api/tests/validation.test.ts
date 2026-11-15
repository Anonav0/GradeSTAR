import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../src/middleware/validate-request.js';
import { paginationQuerySchema, idParamSchema } from '../src/schemas/common.schema.js';
import { createErrorHandler } from '../src/middleware/error-handler.js';
import { createLogger } from '@gradestar/logging';
import { requestIdMiddleware } from '../src/middleware/request-id.js';

describe('API Zod Request Validation Middleware', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });

  describe('Query parameter validation & coercion', () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get(
      '/items',
      validateRequest({ query: paginationQuerySchema }),
      (req: Request, res: Response) => {
        res.json({
          page: req.query['page'],
          limit: req.query['limit'],
          validated: req.validated?.query,
        });
      },
    );
    app.use(createErrorHandler(logger));

    it('coerces and passes valid string query values to downstream handler', async () => {
      const res = await request(app).get('/items?page=3&limit=50');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(3);
      expect(res.body.limit).toBe(50);
      expect(res.body.validated).toEqual({ page: 3, limit: 50 });
    });

    it('applies default pagination values when query parameters are omitted', async () => {
      const res = await request(app).get('/items');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('rejects negative, zero, or non-integer query values with HTTP 400', async () => {
      const resZero = await request(app).get('/items?page=0');
      expect(resZero.status).toBe(400);
      expect(resZero.body.error).toBe('VALIDATION_ERROR');
      expect(resZero.body.message).toBe('Request validation failed');
      expect(resZero.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'page',
            message: 'Page must be a positive integer',
          }),
        ]),
      );

      const resLimitExceeded = await request(app).get('/items?limit=500');
      expect(resLimitExceeded.status).toBe(400);
      expect(resLimitExceeded.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'limit',
            message: 'Limit cannot exceed 100',
          }),
        ]),
      );
    });
  });

  describe('Route parameter validation', () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get(
      '/items/:id',
      validateRequest({ params: idParamSchema }),
      (req: Request, res: Response) => {
        res.json({ id: req.params['id'] });
      },
    );
    app.use(createErrorHandler(logger));

    it('accepts valid UUID route parameter', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get(`/items/${validUuid}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(validUuid);
    });

    it('rejects invalid UUID route parameter with 400', async () => {
      const res = await request(app).get('/items/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual([
        {
          path: 'id',
          message: 'ID must be a valid UUID',
        },
      ]);
    });
  });

  describe('Request body validation', () => {
    const testBodySchema = z.object({
      title: z.string().min(3, 'Title must be at least 3 characters'),
      memoryLimitMb: z.number().int().min(16).max(1024),
    });

    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.post(
      '/problems',
      validateRequest({ body: testBodySchema }),
      (req: Request, res: Response) => {
        res.status(201).json({ created: req.body });
      },
    );
    app.use(createErrorHandler(logger));

    it('accepts valid JSON body and passes parsed data to handler', async () => {
      const payload = { title: 'Two Sum', memoryLimitMb: 256 };
      const res = await request(app).post('/problems').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.created).toEqual(payload);
    });

    it('rejects invalid body schema with HTTP 400 and sanitized issues', async () => {
      const res = await request(app).post('/problems').send({ title: 'X', memoryLimitMb: 5000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'title' }),
          expect.objectContaining({ path: 'memoryLimitMb' }),
        ]),
      );
      // Ensure raw payload is not echoed back in response error
      expect(res.body.details).not.toEqual(expect.stringContaining('5000'));
    });
  });
});
