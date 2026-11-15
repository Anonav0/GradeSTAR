import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { Writable } from 'node:stream';
import pino from 'pino';
import { requestIdMiddleware, isValidRequestId } from '../src/middleware/request-id.js';
import { createRequestLogger } from '../src/middleware/request-logger.js';

describe('API Middleware Tests', () => {
  describe('Request ID Middleware', () => {
    it('generates a valid UUIDv4 when client supplies no header', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test-id', (req: Request, res: Response) => {
        res.json({ id: req.id, requestId: req.requestId });
      });

      const res = await request(app).get('/test-id');
      expect(res.status).toBe(200);
      expect(isValidRequestId(res.body.id)).toBe(true);
      expect(res.body.id).toBe(res.body.requestId);
      expect(res.headers['x-request-id']).toBe(res.body.id);
    });

    it('accepts and preserves valid client-supplied X-Request-Id', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test-id', (req: Request, res: Response) => {
        res.json({ id: req.id });
      });

      const customId = 'client-trace-abc_123-XYZ';
      const res = await request(app).get('/test-id').set('X-Request-Id', customId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customId);
      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('accepts valid X-Correlation-Id if X-Request-Id is absent', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test-id', (req: Request, res: Response) => {
        res.json({ id: req.id });
      });

      const correlationId = 'corr-999-alpha';
      const res = await request(app).get('/test-id').set('X-Correlation-Id', correlationId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(correlationId);
      expect(res.headers['x-request-id']).toBe(correlationId);
    });

    it('validates request ID format helper correctly', () => {
      expect(isValidRequestId('valid-id_123')).toBe(true);
      expect(isValidRequestId('')).toBe(false);
      expect(isValidRequestId('a'.repeat(65))).toBe(false);
      expect(isValidRequestId('id with spaces')).toBe(false);
      expect(isValidRequestId('<script>')).toBe(false);
      expect(isValidRequestId('id\r\ninjection')).toBe(false);
      expect(isValidRequestId(null)).toBe(false);
      expect(isValidRequestId(undefined)).toBe(false);
    });

    it('replaces malformed client ID with a secure UUID', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test-id', (req: Request, res: Response) => {
        res.json({ id: req.id });
      });

      const invalidIds = [
        'id with spaces',
        '<script>alert(1)</script>',
        'a'.repeat(65),
        'id;DROP_TABLE;',
        'id@invalid!',
      ];

      for (const invalidId of invalidIds) {
        const res = await request(app).get('/test-id').set('X-Request-Id', invalidId);
        expect(res.status).toBe(200);
        expect(res.body.id).not.toBe(invalidId);
        expect(isValidRequestId(res.body.id)).toBe(true);
        expect(res.headers['x-request-id']).toBe(res.body.id);
      }
    });

    it('guarantees unique request IDs across concurrent requests', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test-id', (req: Request, res: Response) => {
        res.json({ id: req.id });
      });

      const concurrentRequests = 25;
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app).get('/test-id'),
      );
      const responses = await Promise.all(promises);

      const receivedIds = responses.map((r) => r.body.id);
      const uniqueIds = new Set(receivedIds);

      expect(uniqueIds.size).toBe(concurrentRequests);
    });
  });

  describe('Request Logging Middleware & Redaction', () => {
    it('redacts sensitive headers (authorization, cookie) from structured logs', async () => {
      const logChunks: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          logChunks.push(chunk.toString());
          callback();
        },
      });

      const testLogger = pino({ level: 'info' }, stream);

      const app = express();
      app.use(requestIdMiddleware);
      app.use(createRequestLogger({ logger: testLogger, ignorePaths: [] }));
      app.get('/secure-data', (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      });

      const res = await request(app)
        .get('/secure-data?secretKey=superSecretToken')
        .set('Authorization', 'Bearer secret-jwt-token')
        .set('Cookie', 'session=secret-session-cookie')
        .set('X-Api-Key', 'sensitive-api-key');

      expect(res.status).toBe(200);

      const logOutput = logChunks.join('\n');
      expect(logOutput).not.toContain('secret-jwt-token');
      expect(logOutput).not.toContain('secret-session-cookie');
      expect(logOutput).not.toContain('sensitive-api-key');
      expect(logOutput).not.toContain('superSecretToken');

      expect(logOutput).toContain('/secure-data');
      expect(logOutput).toContain(res.headers['x-request-id']);
    });
  });
});
