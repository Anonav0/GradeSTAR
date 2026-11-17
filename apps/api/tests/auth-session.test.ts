import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma, UserRole } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { hashPassword } from '../src/services/password.service.js';
import { SESSION_COOKIE_NAME, createSessionRecord } from '../src/services/session.service.js';

describe('Auth Session Lifecycle & Management', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  const testEmail = `session-test-${Date.now()}@gradestar.dev`;
  let userId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'session-test-' } },
    });

    const user = await prisma.user.create({
      data: {
        name: 'Session User',
        email: testEmail,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.USER,
      },
    });
    userId = user.id;
  });

  it('GET /api/v1/auth/me returns safe profile with valid session cookie', async () => {
    const { rawToken } = await createSessionRecord(userId);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: userId,
      name: 'Session User',
      email: testEmail,
      role: UserRole.USER,
      createdAt: expect.any(String),
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects unauthenticated request with 401 UNAUTHENTICATED when cookie is missing', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
    expect(res.body.message).toBe('Authentication required');
  });

  it('rejects unknown session token with 401 UNAUTHENTICATED', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=nonexistent-random-token-12345`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
    expect(res.body.message).toBe('Invalid or expired session');
  });

  it('rejects expired session with 401 UNAUTHENTICATED', async () => {
    const { rawToken, session } = await createSessionRecord(userId);

    // Manually set expiration in the past
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 10000) },
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
    expect(res.body.message).toBe('Invalid or expired session');
  });

  it('rejects revoked session with 401 UNAUTHENTICATED', async () => {
    const { rawToken, session } = await createSessionRecord(userId);

    // Manually revoke session
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
    expect(res.body.message).toBe('Invalid or expired session');
  });

  it('rejects session if the user was deleted from the database', async () => {
    const { rawToken } = await createSessionRecord(userId);

    // Delete user (cascade deletes sessions in database)
    await prisma.user.delete({ where: { id: userId } });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
  });

  it('POST /api/v1/auth/logout revokes session on server and clears session cookie', async () => {
    const { rawToken, csrfToken, session } = await createSessionRecord(userId);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`)
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');

    // Verify Set-Cookie header cleared the cookie
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cleared = setCookie?.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(cleared).toContain('Expires=');

    // Verify database record has revokedAt set
    const dbSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(dbSession?.revokedAt).not.toBeNull();

    // Verify the revoked session cannot authenticate subsequent requests
    const subsequentRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(subsequentRes.status).toBe(401);
    expect(subsequentRes.body.error).toBe('UNAUTHENTICATED');
  });

  it('GET /api/v1/auth/csrf returns current session CSRF token for authenticated user', async () => {
    const { rawToken, csrfToken } = await createSessionRecord(userId);

    const res = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBe(csrfToken);
  });
});
