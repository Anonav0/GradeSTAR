import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma, UserRole } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { hashPassword } from '../src/services/password.service.js';
import { SESSION_COOKIE_NAME, createSessionRecord } from '../src/services/session.service.js';
import { checkOwnership } from '../src/middleware/authorize.js';

describe('Resource Ownership Authorization', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger, includeTestRoutes: true });

  const testEmailOwner = `owner-${Date.now()}@gradestar.dev`;
  const testEmailOther = `other-${Date.now()}@gradestar.dev`;
  const testEmailAdmin = `admin-${Date.now()}@gradestar.dev`;

  let ownerId: string;
  let otherUserId: string;
  let adminId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'owner-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'other-' } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'admin-' } },
    });

    const owner = await prisma.user.create({
      data: {
        name: 'Resource Owner',
        email: testEmailOwner,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.USER,
      },
    });
    ownerId = owner.id;

    const other = await prisma.user.create({
      data: {
        name: 'Other User',
        email: testEmailOther,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.USER,
      },
    });
    otherUserId = other.id;

    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: testEmailAdmin,
        passwordHash: await hashPassword('Password123!'),
        role: UserRole.ADMIN,
      },
    });
    adminId = admin.id;
  });

  it('allows owner to access their own resource with 200 OK', async () => {
    const { rawToken } = await createSessionRecord(ownerId);

    const res = await request(app)
      .get(`/api/v1/test/resources/${ownerId}`)
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(ownerId);
    expect(res.body.accessedBy).toBe(ownerId);
  });

  it('rejects non-owner with 403 FORBIDDEN when attempting to access another user resource', async () => {
    const { rawToken } = await createSessionRecord(otherUserId);

    // otherUserId tries to access resource owned by ownerId
    const res = await request(app)
      .get(`/api/v1/test/resources/${ownerId}`)
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toContain('You do not have permission to access this resource');
  });

  it('allows administrator to access user resource under administrative override policy', async () => {
    const { rawToken } = await createSessionRecord(adminId);

    const res = await request(app)
      .get(`/api/v1/test/resources/${ownerId}`)
      .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(ownerId);
    expect(res.body.accessedBy).toBe(adminId);
  });

  it('rejects unauthenticated request with 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get(`/api/v1/test/resources/${ownerId}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
  });

  describe('checkOwnership unit logic', () => {
    it('returns true when currentUserId matches resourceOwnerId', () => {
      expect(
        checkOwnership({
          resourceOwnerId: 'user-123',
          currentUserId: 'user-123',
          currentUserRole: UserRole.USER,
        }),
      ).toBe(true);
    });

    it('returns false when currentUserId does not match and user is not admin', () => {
      expect(
        checkOwnership({
          resourceOwnerId: 'user-123',
          currentUserId: 'user-456',
          currentUserRole: UserRole.USER,
        }),
      ).toBe(false);
    });

    it('returns true when current user is ADMIN and allowAdmin is true', () => {
      expect(
        checkOwnership({
          resourceOwnerId: 'user-123',
          currentUserId: 'admin-999',
          currentUserRole: UserRole.ADMIN,
          allowAdmin: true,
        }),
      ).toBe(true);
    });

    it('returns false when current user is ADMIN but allowAdmin is false', () => {
      expect(
        checkOwnership({
          resourceOwnerId: 'user-123',
          currentUserId: 'admin-999',
          currentUserRole: UserRole.ADMIN,
          allowAdmin: false,
        }),
      ).toBe(false);
    });
  });
});
