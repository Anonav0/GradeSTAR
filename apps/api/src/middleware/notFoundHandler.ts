import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@gradestar/shared';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const response: ApiErrorResponse = {
    statusCode: 404,
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
}
