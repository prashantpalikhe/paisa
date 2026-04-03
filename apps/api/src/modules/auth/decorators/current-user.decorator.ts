/**
 * # @CurrentUser() Decorator
 *
 * Extracts the authenticated user from the request.
 * A clean alternative to accessing `request.user` directly.
 *
 * ## Usage
 *
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthUser) {
 *   return { id: user.id, email: user.email };
 * }
 *
 * // Get just one field
 * @Get('my-email')
 * getEmail(@CurrentUser('email') email: string) {
 *   return { email };
 * }
 * ```
 *
 * ## How it works
 *
 * NestJS custom param decorators receive the request object.
 * JwtAuthGuard/JwtStrategy populates `request.user` with an AuthUser.
 * This decorator simply extracts it (optionally a specific field).
 *
 * ## Why a custom decorator instead of @Req()?
 *
 * ```typescript
 * // Without decorator — coupled to Express, verbose
 * getProfile(@Req() req: Request) {
 *   const user = req.user as AuthUser; // Manual cast, no type safety
 * }
 *
 * // With decorator — clean, type-safe, framework-agnostic
 * getProfile(@CurrentUser() user: AuthUser) {
 *   // Already typed, no casting needed
 * }
 * ```
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@paisa/shared';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    // If a specific field is requested, return just that field
    if (field) {
      return user?.[field];
    }

    // Otherwise return the whole AuthUser object
    return user;
  },
);
