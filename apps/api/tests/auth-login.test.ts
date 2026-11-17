import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma, UserRole } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { hashPassword } from '../src/services/password.service.js';
import { SESSION_COOKIE_NAME, hashSessionToken } from '../src/services/session.service.js';

describe('Auth Login API (/api/v1/auth/login)', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  const testEmail = `login-test-${Date.now()}@gradestar.dev`;
  const validPassword = 'CorrectPassword123!';

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'login-test-' } },
    });

    const passwordHash = await hashPassword(validPassword);
    await prisma.user.create({
      data: {
        name: 'Login User',
        email: testEmail,
        passwordHash,
        role: UserRole.USER,
      },
    });
  });

  it('authenticates valid credentials, sets HTTP-only session cookie, and returns CSRF token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testEmail.toUpperCase(), // Test case-insensitivity
      password: validPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body).toHaveProperty('csrfToken');
    expect(typeof res.body.csrfToken).toBe('string');
    expect(res.body.csrfToken.length).toBe(64);

    // Verify Set-Cookie header
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies?.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie?.toLowerCase()).toContain('samesite=lax');
    expect(sessionCookie).toContain('Path=/');

    // Extract raw session token from cookie
    const rawTokenMatch = sessionCookie?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    expect(rawTokenMatch).not.toBeNull();
    const rawToken = rawTokenMatch![1];

    // Verify tokenHash in PostgreSQL is SHA-256 hash, NOT raw token
    const tokenHash = hashSessionToken(rawToken);
    const sessionInDb = await prisma.session.findUnique({
      where: { tokenHash },
    });
    expect(sessionInDb).not.toBeNull();
    expect(sessionInDb?.tokenHash).toBe(tokenHash);
    expect(sessionInDb?.tokenHash).not.toBe(rawToken);
    expect(sessionInDb?.csrfToken).toBe(res.body.csrfToken);
    expect(sessionInDb?.revokedAt).toBeNull();
  });

  it('rejects incorrect password with generic 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'WrongPassword999!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBe('Invalid email or password');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects nonexistent account with identical generic 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nonexistent-user@gradestar.dev',
      password: 'AnyPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('enforces rate limiting on repeated login attempts', async () => {
    const rateLimitedApp = createApp({
      logger,
      rateLimiterOptions: {
        windowMs: 60 * 1000,
        max: 3, // Allow only 3 attempts
        skip: () => false, // Do not skip in test
      },
    });

    // Send 3 requests (within quota)
    for (let i = 0; i < 3; i++) {
      const res = await request(rateLimitedApp).post('/api/v1/auth/login').send({
        email: testEmail,
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
    }

    // 4th request must be rejected with 429 Too Many Requests
    const res4 = await request(rateLimitedApp).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'WrongPassword!',
    });

    expect(res4.status).toBe(429);
    expect(res4.body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(res4.body.message).toContain('Too many');
  });
});
