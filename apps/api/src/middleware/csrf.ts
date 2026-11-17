import type { Request, Response, NextFunction } from 'express';
import { constantTimeEquals } from '../services/session.service.js';
import { AppError } from '../errors/app-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Validates CSRF token for state-changing requests against the authenticated session secret.
 * Safe methods (GET, HEAD, OPTIONS) do not require a CSRF token.
 */
export function validateCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const sessionCsrfToken = req.session?.csrfToken;
  if (!sessionCsrfToken) {
    return next(
      AppError.forbidden(
        'CSRF token validation requires an authenticated session',
        'CSRF_VALIDATION_FAILED',
      ),
    );
  }

  const incomingTokenHeader = req.headers['x-csrf-token'];
  const incomingToken = Array.isArray(incomingTokenHeader)
    ? incomingTokenHeader[0]
    : incomingTokenHeader;

  if (!incomingToken || typeof incomingToken !== 'string') {
    return next(
      AppError.forbidden(
        'Missing required CSRF token in X-CSRF-Token header',
        'CSRF_VALIDATION_FAILED',
      ),
    );
  }

  if (!constantTimeEquals(incomingToken, sessionCsrfToken)) {
    return next(AppError.forbidden('Invalid CSRF token', 'CSRF_VALIDATION_FAILED'));
  }

  next();
}
