import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma, UserRole } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { hashPassword } from '../src/services/password.service.js';
import { SESSION_COOKIE_NAME, createSessionRecord } from '../src/services/session.service.js';

describe('Role-Based Authorization Middleware (/api/v1/test/*)', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger, includeTestRoutes: true });

  const testEmailUser = `role-user-${Date.now()}@gradestar.dev`;
  const testEmailAdmin = `role-admin-${Date.now()}@gradestar.dev`;
  let regularUserId: string;
  let adminUserId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'role-' } },
    });

    const regularUser = await prisma.user.create({
      data: {
        name: 'Regular User',
        email: testEmailUser,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.USER,
      },
    });
    regularUserId = regularUser.id;

    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: testEmailAdmin,
        passwordHash: await hashPassword('AdminPassword123!'),
        role: UserRole.ADMIN,
      },
    });
    adminUserId = adminUser.id;
  });

  it('rejects unauthenticated caller with 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/test/admin-only');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
  });

  it('rejects USER role with 403 FORBIDDEN when attempting to access ADMIN route', async () => {
    const { rawToken } = await createSessionRecord(regularUserId);

    const res = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toContain('Insufficient permissions');
  });

  it('allows ADMIN role to access ADMIN-only route with 200 OK', async () => {
    const { rawToken } = await createSessionRecord(adminUserId);

    const res = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('admin access granted');
  });

  it('allows both USER and ADMIN on multi-role authorized route', async () => {
    const userSession = await createSessionRecord(regularUserId);
    const adminSession = await createSessionRecord(adminUserId);

    const resUser = await request(app)
      .get('/api/v1/test/user-or-admin')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${userSession.rawToken}`);
    expect(resUser.status).toBe(200);
    expect(resUser.body.message).toBe('authorized');

    const resAdmin = await request(app)
      .get('/api/v1/test/user-or-admin')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${adminSession.rawToken}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.message).toBe('authorized');
  });

  it('respects real-time role changes in the database without relying on stale tokens', async () => {
    const { rawToken } = await createSessionRecord(regularUserId);

    // Initial check: regular user cannot access admin route
    const res1 = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);
    expect(res1.status).toBe(403);

    // Promote regular user to ADMIN in PostgreSQL
    await prisma.user.update({
      where: { id: regularUserId },
      data: { role: UserRole.ADMIN },
    });

    // Subsequent request with the same session token is immediately granted access
    const res2 = await request(app)
      .get('/api/v1/test/admin-only')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe('admin access granted');
  });
});
