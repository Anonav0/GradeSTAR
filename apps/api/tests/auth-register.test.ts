import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma, UserRole } from '@gradestar/database';
import { createApp } from '../src/app.js';
import { createLogger } from '@gradestar/logging';
import { verifyPassword } from '../src/services/password.service.js';

describe('Auth Registration API (/api/v1/auth/register)', () => {
  const logger = createLogger({ serviceName: 'test-api', logLevel: 'silent' });
  const app = createApp({ logger });

  const testEmailPrefix = `reg-test-${Date.now()}`;

  beforeEach(async () => {
    // Cleanup any users created in this test suite
    await prisma.user.deleteMany({
      where: { email: { contains: testEmailPrefix } },
    });
  });

  it('successfully registers a user with normalized email, hashed password, and default USER role', async () => {
    const rawEmail = `  ${testEmailPrefix}-ALICE@GradeStar.DEV  `;
    const payload = {
      name: 'Alice Developer',
      email: rawEmail,
      password: 'SecurePassword123!',
    };

    const res = await request(app).post('/api/v1/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Alice Developer');
    expect(res.body.email).toBe(rawEmail.toLowerCase().trim());
    expect(res.body.role).toBe(UserRole.USER);
    expect(res.body).toHaveProperty('createdAt');

    // Never return passwordHash in response
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');

    // Verify record in PostgreSQL
    const savedUser = await prisma.user.findUnique({
      where: { email: rawEmail.toLowerCase().trim() },
    });
    expect(savedUser).not.toBeNull();
    expect(savedUser?.passwordHash).not.toBeNull();
    expect(savedUser?.passwordHash).not.toBe('SecurePassword123!');
    expect(savedUser?.passwordHash?.startsWith('$argon2id$')).toBe(true);

    // Verify password verification succeeds with saved Argon2id hash
    const isMatch = await verifyPassword(savedUser!.passwordHash!, 'SecurePassword123!');
    expect(isMatch).toBe(true);
  });

  it('rejects duplicate email registration with HTTP 409 Conflict', async () => {
    const email = `${testEmailPrefix}-dup@gradestar.dev`;
    const payload = {
      name: 'First User',
      email,
      password: 'ValidPassword123!',
    };

    const res1 = await request(app).post('/api/v1/auth/register').send(payload);
    expect(res1.status).toBe(201);

    // Attempt second registration with mixed casing of the same email
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Second User',
      email: email.toUpperCase(),
      password: 'AnotherPassword456!',
    });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toBe('ACCOUNT_ALREADY_EXISTS');
    expect(res2.body.message).toContain('already exists');
    expect(res2.body).toHaveProperty('requestId');
  });

  it('prevents concurrent duplicate registration attempts from creating duplicate accounts', async () => {
    const email = `${testEmailPrefix}-concurrent@gradestar.dev`;
    const payload = {
      name: 'Concurrent User',
      email,
      password: 'ConcurrentPassword123!',
    };

    // Fire 5 concurrent registration requests for the same email
    const promises = Array.from({ length: 5 }, () =>
      request(app).post('/api/v1/auth/register').send(payload),
    );

    const responses = await Promise.all(promises);
    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(4);

    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);
  });

  it('rejects user-supplied ADMIN role and unexpected server-controlled fields', async () => {
    const email = `${testEmailPrefix}-hacker@gradestar.dev`;
    const payload = {
      name: 'Attacker',
      email,
      password: 'Password1234!',
      role: 'ADMIN', // Injection attempt
    };

    const res = await request(app).post('/api/v1/auth/register').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.details)).toContain('Unrecognized key(s)');
  });

  it('validates password minimum length (8) and maximum length (128)', async () => {
    const shortRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Short Pwd',
        email: `${testEmailPrefix}-short@gradestar.dev`,
        password: 'short',
      });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.error).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(shortRes.body.details)).toContain(
      'Password must be at least 8 characters',
    );

    const longRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Long Pwd',
        email: `${testEmailPrefix}-long@gradestar.dev`,
        password: 'a'.repeat(129),
      });
    expect(longRes.status).toBe(400);
    expect(longRes.body.error).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(longRes.body.details)).toContain('Password cannot exceed 128 characters');
  });

  it('rejects malformed email address and missing name', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'ValidPassword123!',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
