import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma, UserRole } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { hashPassword } from '../src/services/password.service.js';
import { SESSION_COOKIE_NAME, createSessionRecord } from '../src/services/session.service.js';

describe('CSRF Protection Verification', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger, includeTestRoutes: true });

  const testEmailA = `csrf-user-a-${Date.now()}@gradestar.dev`;
  const testEmailB = `csrf-user-b-${Date.now()}@gradestar.dev`;
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'csrf-user-' } },
    });

    const userA = await prisma.user.create({
      data: {
        name: 'User A',
        email: testEmailA,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.USER,
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        name: 'User B',
        email: testEmailB,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.USER,
      },
    });
    userBId = userB.id;
  });

  it('allows state-changing authenticated request with valid matching X-CSRF-Token', async () => {
    const { rawToken, csrfToken } = await createSessionRecord(userAId);

    const res = await request(app)
      .post('/api/v1/test/protected-action')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ action: 'update' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects state-changing request when X-CSRF-Token header is completely missing', async () => {
    const { rawToken } = await createSessionRecord(userAId);

    const res = await request(app)
      .post('/api/v1/test/protected-action')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`)
      .send({ action: 'update' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_VALIDATION_FAILED');
    expect(res.body.message).toContain('Missing required CSRF token');
  });

  it('rejects state-changing request when X-CSRF-Token is invalid or corrupted', async () => {
    const { rawToken } = await createSessionRecord(userAId);

    const res = await request(app)
      .post('/api/v1/test/protected-action')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`)
      .set('X-CSRF-Token', 'invalid-corrupted-csrf-token-abc123')
      .send({ action: 'update' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_VALIDATION_FAILED');
    expect(res.body.message).toBe('Invalid CSRF token');
  });

  it('rejects state-changing request when CSRF token belongs to another user session', async () => {
    const sessionA = await createSessionRecord(userAId);
    const sessionB = await createSessionRecord(userBId);

    // Present userA session cookie but userB csrfToken
    const res = await request(app)
      .post('/api/v1/test/protected-action')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${sessionA.rawToken}`)
      .set('X-CSRF-Token', sessionB.csrfToken)
      .send({ action: 'update' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_VALIDATION_FAILED');
    expect(res.body.message).toBe('Invalid CSRF token');
  });

  it('does NOT require CSRF token for safe read-only methods (GET)', async () => {
    const { rawToken } = await createSessionRecord(userAId);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmailA);
  });

  it('does NOT require CSRF token for public unauthenticated endpoints (login, register)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testEmailA,
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('csrfToken');
  });
});
