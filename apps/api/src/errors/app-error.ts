export interface AppErrorOptions {
  details?: unknown;
  isOperational?: boolean;
  cause?: unknown;
}

/**
 * Standard typed application error for GradeSTAR backend services.
 * Distinguishes operational (expected client/service) errors from programmer/unexpected defects.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: AppErrorOptions | unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;

    if (
      options &&
      typeof options === 'object' &&
      ('details' in options || 'isOperational' in options || 'cause' in options)
    ) {
      const opts = options as AppErrorOptions;
      this.details = opts.details;
      this.isOperational = opts.isOperational ?? true;
      if (opts.cause !== undefined) {
        this.cause = opts.cause;
      }
    } else {
      this.details = options;
      this.isOperational = true;
    }

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(400, code, message, { details });
  }

  static notFound(message: string, code = 'NOT_FOUND', details?: unknown): AppError {
    return new AppError(404, code, message, { details });
  }

  static conflict(message: string, code = 'CONFLICT', details?: unknown): AppError {
    return new AppError(409, code, message, { details });
  }

  static tooManyRequests(
    message = 'Too many requests, please try again later',
    code = 'RATE_LIMITED',
  ): AppError {
    return new AppError(429, code, message);
  }

  static internal(
    message = 'An unexpected internal error occurred',
    code = 'INTERNAL_ERROR',
    cause?: unknown,
  ): AppError {
    return new AppError(500, code, message, { cause, isOperational: false });
  }

  static serviceUnavailable(
    message = 'Service temporarily unavailable',
    code = 'SERVICE_UNAVAILABLE',
    cause?: unknown,
  ): AppError {
    return new AppError(503, code, message, { cause, isOperational: true });
  }
}
