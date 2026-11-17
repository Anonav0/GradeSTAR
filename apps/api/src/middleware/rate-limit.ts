import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  skip?: (req: Request) => boolean;
}

/**
 * Creates an Express rate limiter for sensitive authentication endpoints (login, registration).
 * Emits standard GradeSTAR 429 error responses on rate limit exhaustion.
 */
export function createAuthRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000; // 15 minutes default
  const max = options.max ?? (process.env['NODE_ENV'] === 'test' ? 1000 : 10);
  const message = options.message ?? 'Too many authentication attempts, please try again later';

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(AppError.tooManyRequests(message, 'RATE_LIMIT_EXCEEDED'));
    },
    skip: options.skip ?? (() => process.env['DISABLE_RATE_LIMITS'] === 'true'),
  });
}
