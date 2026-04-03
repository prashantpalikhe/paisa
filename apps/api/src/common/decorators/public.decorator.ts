import { SetMetadata } from '@nestjs/common';

/**
 * # @Public() Decorator
 *
 * Marks an endpoint as publicly accessible (no JWT required).
 * Used with the JwtAuthGuard to skip authentication.
 *
 * ## Usage
 *
 * ```typescript
 * @Public()
 * @Get('pricing')
 * getPricing() { ... }
 * ```
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
