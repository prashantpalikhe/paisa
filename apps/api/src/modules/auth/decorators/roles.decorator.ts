/**
 * # @Roles() Decorator
 *
 * Marks a route or controller as requiring specific user roles.
 * Used in combination with RolesGuard.
 *
 * ## Usage
 *
 * ```typescript
 * // Single role
 * @Roles('ADMIN')
 * @Get('admin/dashboard')
 * dashboard() { ... }
 *
 * // Multiple roles
 * @Roles('ADMIN', 'MODERATOR')
 * @Delete('posts/:id')
 * deletePost() { ... }
 *
 * // On a controller (applies to all routes)
 * @Roles('ADMIN')
 * @Controller('admin')
 * export class AdminController { ... }
 * ```
 *
 * ## How it works
 *
 * This decorator simply attaches metadata (the list of roles) to the route.
 * RolesGuard reads this metadata at runtime and checks the user's role.
 *
 * It's a "metadata decorator" pattern — the decorator itself does nothing,
 * the guard does the actual enforcement.
 */
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@paisa/shared';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
