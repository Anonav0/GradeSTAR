import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '@gradestar/logging';
import type { ApiErrorResponse } from '@gradestar/shared';
import { ZodError } from 'zod';

export function createErrorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const isProduction = process.env['NODE_ENV'] === 'production';
    let statusCode = 500;
    let error = 'InternalServerError';
    let message = 'An unexpected internal error occurred';
    let details: unknown = undefined;

    if (
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status: number }).status === 400
    ) {
      statusCode = 400;
      error = 'BadRequest';
      message = 'Malformed JSON payload in request body';
    } else if (err instanceof ZodError) {
      statusCode = 400;
      error = 'ValidationError';
      message = 'Request validation failed';
      details = err.errors;
    } else if (err instanceof Error) {
      if ('statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number') {
        statusCode = (err as { statusCode: number }).statusCode;
        error = err.name || 'HttpError';
      }
      message = err.message;
    }

    if (statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Unhandled server error');
      if (isProduction) {
        message = 'An unexpected internal error occurred';
      }
    } else {
      logger.warn({ err, path: req.path, method: req.method, statusCode }, 'Client error occurred');
    }

    const payload: ApiErrorResponse = {
      statusCode,
      error,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(payload);
  };
}
