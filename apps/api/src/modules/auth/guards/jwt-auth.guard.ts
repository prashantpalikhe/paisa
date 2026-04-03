/**
 * # JWT Auth Guard
 *
 * The GLOBAL authentication guard. Applied to every route by default.
 * Routes marked with `@Public()` skip authentication.
 *
 * ## How it works
 *
 * ```
 * Every request
 *       │
 *       ▼
 * JwtAuthGuard.canActivate()
 *       │
 *       ├── Route has @Public() metadata? → Allow through (no auth needed)
 *       │
 *       ▼
 * Passport JWT Strategy validates the token
 *       │
 *       ├── No token / invalid / expired → 401 Unauthorized
 *       │
 *       ▼
 * request.user = AuthUser (populated by JwtStrategy.validate())
 *       │
 *       ▼
 * Controller method runs
 * ```
 *
 * ## Why a global guard?
 *
 * Most routes need authentication. Instead of adding `@UseGuards(JwtAuthGuard)`
 * to every controller, we apply it globally and opt-out with `@Public()`.
 *
 * This is SAFER: if you forget to add a guard, the route is protected by default.
 * The alternative (no global guard) means forgetting to add it = security hole.
 */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Check if the route is public. If so, skip JWT validation.
   * Otherwise, delegate to Passport's JWT strategy.
   */
  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator on the handler (method) or class (controller)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Check the method first
      context.getClass(), // Then check the class
    ]);

    if (isPublic) {
      return true; // Skip authentication
    }

    // Delegate to Passport JWT strategy
    return super.canActivate(context);
  }
}
