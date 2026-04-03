/**
 * # Roles Guard
 *
 * Role-based access control (RBAC). Checks if the authenticated user
 * has the required role for the route.
 *
 * ## Usage
 *
 * ```typescript
 * @Roles('ADMIN')
 * @Get('admin/users')
 * listUsers() { ... }
 * ```
 *
 * ## How it works
 *
 * ```
 * Request (after JwtAuthGuard has run)
 *       │
 *       ▼
 * RolesGuard.canActivate()
 *       │
 *       ├── No @Roles() decorator? → Allow (any authenticated user)
 *       │
 *       ▼
 * Check if request.user.role is in the required roles
 *       │
 *       ├── Not in list? → 403 Forbidden
 *       │
 *       ▼
 * Controller method runs
 * ```
 *
 * ## Why not combine with JwtAuthGuard?
 *
 * Separation of concerns:
 * - JwtAuthGuard answers: "Is the user authenticated?"
 * - RolesGuard answers: "Is the user authorized?"
 *
 * These are different questions. Some routes need auth but not specific roles.
 * Some admin routes need both. Keeping them separate is more flexible.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '@paisa/shared';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get the required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator → any authenticated user can access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get the authenticated user (set by JwtAuthGuard → JwtStrategy)
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      // This shouldn't happen if JwtAuthGuard ran first, but just in case
      throw new ForbiddenException('No user found on request');
    }

    // Check if the user's role is in the required list
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
