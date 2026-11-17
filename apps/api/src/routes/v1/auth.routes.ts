import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma, UserRole, isUniqueConstraintViolation } from '@gradestar/database';
import { registerSchema, loginSchema } from '../../schemas/auth.schema.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { hashPassword, verifyPassword } from '../../services/password.service.js';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  createSessionRecord,
  revokeSessionRecord,
} from '../../services/session.service.js';
import { authenticate, toSafeUser } from '../../middleware/authenticate.js';
import { validateCsrf } from '../../middleware/csrf.js';
import { createAuthRateLimiter, type RateLimiterOptions } from '../../middleware/rate-limit.js';
import { AppError } from '../../errors/app-error.js';

export interface AuthRouterOptions {
  rateLimiterOptions?: RateLimiterOptions;
}

/**
 * Creates authentication and session management routes (/api/v1/auth/*).
 */
export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const rateLimiter = createAuthRateLimiter(options.rateLimiterOptions);
  const isProduction = process.env['NODE_ENV'] === 'production';

  /**
   * POST /api/v1/auth/register
   * Registers a new user account with hashed password and standard USER role.
   */
  router.post(
    '/register',
    rateLimiter,
    validateRequest({ body: registerSchema }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { name, email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Application-level precheck
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (existing) {
          throw AppError.conflict(
            'An account with this email address already exists',
            'ACCOUNT_ALREADY_EXISTS',
          );
        }

        const passwordHash = await hashPassword(password);

        try {
          const user = await prisma.user.create({
            data: {
              name: name.trim(),
              email: normalizedEmail,
              passwordHash,
              role: UserRole.USER, // Server-enforced role assignment
            },
          });

          res.status(201).json(toSafeUser(user));
        } catch (dbErr) {
          if (isUniqueConstraintViolation(dbErr)) {
            throw AppError.conflict(
              'An account with this email address already exists',
              'ACCOUNT_ALREADY_EXISTS',
            );
          }
          throw dbErr;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/v1/auth/login
   * Authenticates user credentials and establishes a database-backed HTTP-only session.
   */
  router.post(
    '/login',
    rateLimiter,
    validateRequest({ body: loginSchema }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user || !user.passwordHash) {
          throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
        }

        const isPasswordValid = await verifyPassword(user.passwordHash, password);
        if (!isPasswordValid) {
          throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
        }

        const { rawToken, csrfToken } = await createSessionRecord(user.id);

        res.cookie(SESSION_COOKIE_NAME, rawToken, getSessionCookieOptions(isProduction));

        res.status(200).json({
          user: toSafeUser(user),
          csrfToken,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/v1/auth/logout
   * Invalidates server-side session and clears client session cookie. Requires CSRF verification.
   */
  router.post(
    '/logout',
    authenticate,
    validateCsrf,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (req.session?.tokenHash) {
          await revokeSessionRecord(req.session.tokenHash);
        }

        res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(isProduction));
        res.status(200).json({ message: 'Logged out successfully' });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/auth/me
   * Retrieves authenticated user's safe public profile.
   */
  router.get('/me', authenticate, (req: Request, res: Response): void => {
    res.status(200).json({ user: req.user });
  });

  /**
   * GET /api/v1/auth/csrf
   * Returns current session's CSRF token for authenticated clients.
   */
  router.get('/csrf', authenticate, (req: Request, res: Response): void => {
    res.status(200).json({ csrfToken: req.session?.csrfToken });
  });

  return router;
}
