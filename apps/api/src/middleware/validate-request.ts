import type { Request, Response, NextFunction } from 'express';
import { type ZodType, ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validated?: {
        params?: unknown;
        query?: unknown;
        body?: unknown;
      };
    }
  }
}

export interface RequestValidationSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

/**
 * Formats Zod validation issues into safe, sanitized, machine-readable field details.
 * Prevents leaking raw input payload values or credentials in error messages.
 */
export function formatZodError(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map((err) => ({
    path: err.path.join('.') || 'root',
    message: err.message,
  }));
}

/**
 * Reusable middleware for validating and transforming Express request inputs (params, query, body).
 * Downstream handlers receive parsed and validated data.
 * Rejections produce HTTP 400 with machine-readable VALIDATION_ERROR details.
 */
export function validateRequest(schemas: RequestValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated: NonNullable<Request['validated']> = req.validated ?? {};

      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = parsedParams as Record<string, string>;
        validated.params = parsedParams;
      }

      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        req.query = parsedQuery as Request['query'];
        validated.query = parsedQuery;
      }

      if (schemas.body) {
        const parsedBody = await schemas.body.parseAsync(req.body);
        req.body = parsedBody;
        validated.body = parsedBody;
      }

      req.validated = validated;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = formatZodError(err);
        next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', { details }));
      } else {
        next(err);
      }
    }
  };
}
