import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@gradestar/shared';

/**
 * Handles unmatched routes by returning a structured JSON 404 response
 * with requestId and timestamp.
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const rawRequestId =
    req.id || req.requestId || (res.getHeader('X-Request-Id') as string | undefined);
  const requestId = typeof rawRequestId === 'string' ? rawRequestId : undefined;

  const response: ApiErrorResponse = {
    statusCode: 404,
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    ...(requestId ? { requestId } : {}),
  };

  res.status(404).json(response);
}
