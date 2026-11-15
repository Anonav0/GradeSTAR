import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
    }
  }
}

/**
 * Validates whether a client-provided request ID conforms to bounded alphanumeric/dash/underscore format.
 * Length must be between 1 and 64 characters to prevent memory exhaustion and header injection.
 */
export const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidRequestId(id: unknown): id is string {
  return typeof id === 'string' && REQUEST_ID_REGEX.test(id);
}

/**
 * Middleware that assigns a unique Request ID to each incoming HTTP request.
 * If the client provides a valid X-Request-Id or X-Correlation-Id, it is preserved.
 * Otherwise, a cryptographic UUIDv4 is generated.
 * The request ID is attached to req.id, req.requestId, and set on the response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const rawId = Array.isArray(incomingId) ? incomingId[0] : incomingId;

  const resolvedId = isValidRequestId(rawId) ? rawId : randomUUID();

  req.id = resolvedId;
  req.requestId = resolvedId;
  res.setHeader('X-Request-Id', resolvedId);

  next();
}
