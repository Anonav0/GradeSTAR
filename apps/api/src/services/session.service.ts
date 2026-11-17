import crypto from 'node:crypto';
import type { CookieOptions } from 'express';
import { prisma, type Session, type User, type Prisma } from '@gradestar/database';

export const SESSION_COOKIE_NAME = 'gradestar_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Returns cookie options enforcing HTTP-only, Path=/, SameSite=Lax, and conditional Secure flags.
 */
export function getSessionCookieOptions(
  isProduction = process.env['NODE_ENV'] === 'production',
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

/**
 * Generates a high-entropy cryptographically random session token (32 bytes / 64 hex characters).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a deterministic SHA-256 hash of a raw session token.
 * Only the hash is ever persisted to PostgreSQL, preventing token leakage from database dumps.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically random CSRF token tied to a session.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compares two strings in constant time to prevent timing-attack side-channel leaks.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface CreatedSession {
  rawToken: string;
  csrfToken: string;
  session: Session;
}

export type SessionWithUser = Session & { user: User };

/**
 * Creates and persists a new database-backed session for an authenticated user.
 */
export async function createSessionRecord(
  userId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CreatedSession> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      csrfToken,
      expiresAt,
    },
  });

  return { rawToken, csrfToken, session };
}

/**
 * Validates a candidate raw session token against PostgreSQL.
 * Verifies that the session exists, is not revoked, has not expired, and belongs to an existing user.
 */
export async function validateSessionToken(
  rawToken: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<SessionWithUser | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check revocation and expiration
  if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return session;
}

/**
 * Revokes a session on the server by setting its revokedAt timestamp.
 */
export async function revokeSessionRecord(
  tokenHash: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await db.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
