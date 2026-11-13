import { Prisma } from '@prisma/client';

/**
 * Standard PostgreSQL/Prisma error codes for relational data integrity.
 */
export const DatabaseErrorCode = {
  UNIQUE_VIOLATION: 'P2002',
  FOREIGN_KEY_VIOLATION: 'P2003',
  CONSTRAINT_VIOLATION: 'P2004',
  RAW_QUERY_FAILED: 'P2010',
  RECORD_NOT_FOUND: 'P2025',
  TRANSACTION_CONFLICT: 'P2034',
} as const;

export type DatabaseErrorCodeType = (typeof DatabaseErrorCode)[keyof typeof DatabaseErrorCode];

export type DatabaseErrorCategory =
  | 'UNIQUE_VIOLATION'
  | 'FOREIGN_KEY_VIOLATION'
  | 'CHECK_CONSTRAINT_VIOLATION'
  | 'RECORD_NOT_FOUND'
  | 'TRANSACTION_CONFLICT'
  | 'CONNECTION_ERROR'
  | 'UNKNOWN';

export interface ClassifiedDatabaseError {
  category: DatabaseErrorCategory;
  code?: string;
  message: string;
  target?: string[];
  meta?: Record<string, unknown>;
}

/**
 * Type guard for PrismaClientKnownRequestError.
 */
export function isPrismaKnownRequestError(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * Checks whether an error is a unique constraint violation (P2002).
 */
export function isUniqueConstraintViolation(err: unknown): boolean {
  return isPrismaKnownRequestError(err) && err.code === DatabaseErrorCode.UNIQUE_VIOLATION;
}

/**
 * Checks whether an error is a foreign key constraint violation (P2003).
 */
export function isForeignKeyViolation(err: unknown): boolean {
  return isPrismaKnownRequestError(err) && err.code === DatabaseErrorCode.FOREIGN_KEY_VIOLATION;
}

/**
 * Checks whether an error is a record not found error (P2025).
 */
export function isRecordNotFound(err: unknown): boolean {
  return isPrismaKnownRequestError(err) && err.code === DatabaseErrorCode.RECORD_NOT_FOUND;
}

/**
 * Checks whether an error is a database CHECK constraint violation.
 * PostgreSQL check constraint violations (code 23514) can surface as P2004, P2010,
 * or PrismaClientUnknownRequestError wrapping the Postgres driver error.
 */
export function isCheckConstraintViolation(err: unknown): boolean {
  if (isPrismaKnownRequestError(err)) {
    if (err.code === DatabaseErrorCode.CONSTRAINT_VIOLATION) {
      return true;
    }
    if (err.code === DatabaseErrorCode.RAW_QUERY_FAILED) {
      const msg = err.message.toLowerCase();
      return (
        msg.includes('check constraint') || msg.includes('violates check') || msg.includes('23514')
      );
    }
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('check constraint') || msg.includes('violates check') || msg.includes('23514')
    );
  }

  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = String((err as { message: unknown }).message).toLowerCase();
    return (
      msg.includes('check constraint') || msg.includes('violates check') || msg.includes('23514')
    );
  }

  return false;
}

/**
 * Checks whether an error is a transaction conflict or deadlock (P2034).
 */
export function isTransactionConflict(err: unknown): boolean {
  return isPrismaKnownRequestError(err) && err.code === DatabaseErrorCode.TRANSACTION_CONFLICT;
}

/**
 * Classifies an unknown database error into a structured domain representation.
 */
export function classifyDatabaseError(err: unknown): ClassifiedDatabaseError {
  if (isCheckConstraintViolation(err)) {
    return {
      category: 'CHECK_CONSTRAINT_VIOLATION',
      code: isPrismaKnownRequestError(err) ? err.code : '23514',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (isPrismaKnownRequestError(err)) {
    let category: DatabaseErrorCategory = 'UNKNOWN';
    const target = Array.isArray(err.meta?.['target'])
      ? (err.meta['target'] as string[])
      : undefined;

    switch (err.code) {
      case DatabaseErrorCode.UNIQUE_VIOLATION:
        category = 'UNIQUE_VIOLATION';
        break;
      case DatabaseErrorCode.FOREIGN_KEY_VIOLATION:
        category = 'FOREIGN_KEY_VIOLATION';
        break;
      case DatabaseErrorCode.CONSTRAINT_VIOLATION:
        category = 'CHECK_CONSTRAINT_VIOLATION';
        break;
      case DatabaseErrorCode.RECORD_NOT_FOUND:
        category = 'RECORD_NOT_FOUND';
        break;
      case DatabaseErrorCode.TRANSACTION_CONFLICT:
        category = 'TRANSACTION_CONFLICT';
        break;
    }

    return {
      category,
      code: err.code,
      message: err.message,
      target,
      meta: err.meta as Record<string, unknown> | undefined,
    };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      category: 'CONNECTION_ERROR',
      code: err.errorCode,
      message: err.message,
    };
  }

  return {
    category: 'UNKNOWN',
    message: err instanceof Error ? err.message : String(err),
  };
}
