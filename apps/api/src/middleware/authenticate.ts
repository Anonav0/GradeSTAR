import type { Request, Response, NextFunction } from 'express';
import { UserRole, type Session } from '@gradestar/database';
import { SESSION_COOKIE_NAME, validateSessionToken } from '../services/session.service.js';
import { AppError } from '../errors/app-error.js';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string | Date;
}

export function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SafeUser;
      session?: Session;
    }
  }
}

/**
 * Middleware that authenticates an incoming request using a database-backed session cookie.
 * Rejects missing, expired, or revoked sessions with HTTP 401.
 * Resolves and attaches the authenticated safe user context to req.user and req.session.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken || typeof rawToken !== 'string') {
      throw AppError.unauthenticated('Authentication required', 'UNAUTHENTICATED');
    }

    const sessionWithUser = await validateSessionToken(rawToken);

    if (!sessionWithUser) {
      throw AppError.unauthenticated('Invalid or expired session', 'UNAUTHENTICATED');
    }

    req.user = toSafeUser(sessionWithUser.user);
    req.session = sessionWithUser;

    next();
  } catch (err) {
    next(err);
  }
}
