import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@gradestar/database';
import { AppError } from '../errors/app-error.js';

/**
 * Middleware factory that enforces role-based access control on authenticated routes.
 * Must be mounted after authenticate middleware.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthenticated('Authentication required', 'UNAUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden('Insufficient permissions to access this resource', 'FORBIDDEN'),
      );
    }

    next();
  };
}

export interface OwnershipParams {
  resourceOwnerId: string;
  currentUserId: string;
  currentUserRole?: UserRole;
  allowAdmin?: boolean;
}

/**
 * Checks whether the current user is authorized to access or modify a resource based on ownership.
 * Grants access if currentUserId matches resourceOwnerId, or if allowAdmin is true and user is ADMIN.
 */
export function checkOwnership({
  resourceOwnerId,
  currentUserId,
  currentUserRole,
  allowAdmin = true,
}: OwnershipParams): boolean {
  if (currentUserId === resourceOwnerId) {
    return true;
  }
  if (allowAdmin && currentUserRole === UserRole.ADMIN) {
    return true;
  }
  return false;
}

/**
 * Reusable middleware asserting resource ownership.
 */
export function requireOwnership(
  getResourceOwnerId: (req: Request) => Promise<string | null> | string | null,
  options: { allowAdmin?: boolean } = {},
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthenticated('Authentication required', 'UNAUTHENTICATED'));
      }

      const resourceOwnerId = await getResourceOwnerId(req);

      if (!resourceOwnerId) {
        return next(AppError.notFound('Requested resource not found', 'RESOURCE_NOT_FOUND'));
      }

      const isAuthorized = checkOwnership({
        resourceOwnerId,
        currentUserId: req.user.id,
        currentUserRole: req.user.role,
        allowAdmin: options.allowAdmin ?? true,
      });

      if (!isAuthorized) {
        return next(
          AppError.forbidden('You do not have permission to access this resource', 'FORBIDDEN'),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
