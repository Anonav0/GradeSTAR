import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '@gradestar/logging';
import type { ApiErrorResponse } from '@gradestar/shared';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { formatZodError } from './validate-request.js';

export function createErrorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    // If headers were already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(err);
    }

    const isProduction = process.env['NODE_ENV'] === 'production';
    const rawRequestId =
      req.id || req.requestId || (res.getHeader('X-Request-Id') as string | undefined);
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : undefined;

    let statusCode = 500;
    let error = 'InternalServerError';
    let message = 'An unexpected internal error occurred';
    let details: unknown = undefined;

    if (err instanceof AppError) {
      statusCode = err.statusCode;
      error = err.code;
      message = err.message;
      details = err.details;
    } else if (
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status: number }).status === 400
    ) {
      statusCode = 400;
      error = 'BadRequest';
      message = 'Malformed JSON payload in request body';
    } else if (err instanceof ZodError) {
      statusCode = 400;
      error = 'VALIDATION_ERROR';
      message = 'Request validation failed';
      details = formatZodError(err);
    } else if (err instanceof Error) {
      if ('statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number') {
        statusCode = (err as { statusCode: number }).statusCode;
        error = err.name || 'HttpError';
      }
      message = err.message;
    }

    if (statusCode >= 500) {
      logger.error(
        { err, path: req.path, method: req.method, requestId },
        'Unhandled server error occurred',
      );
      if (isProduction) {
        message = 'An unexpected internal error occurred';
        details = undefined;
      }
    } else {
      logger.warn(
        { err, path: req.path, method: req.method, statusCode, requestId },
        'Client error occurred',
      );
    }

    const payload: ApiErrorResponse = {
      statusCode,
      error,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    };

    res.status(statusCode).json(payload);
  };
}
