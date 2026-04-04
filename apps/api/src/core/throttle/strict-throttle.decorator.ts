/**
 * # @StrictThrottle() Decorator
 *
 * Overrides the default rate limit to a stricter tier for sensitive endpoints
 * like login, register, and password reset.
 *
 * - Production: 10 requests per 60 seconds per IP
 * - Test: 1000 requests per 60 seconds (to avoid interfering with e2e tests)
 *
 * ## Usage
 *
 * ```typescript
 * @StrictThrottle()
 * @Post('login')
 * login() { ... }
 * ```
 */
import { Throttle } from '@nestjs/throttler';

const isTest = process.env.NODE_ENV === 'test';

export const StrictThrottle = () =>
  Throttle({
    default: { ttl: 60_000, limit: isTest ? 1000 : 10 },
  });
