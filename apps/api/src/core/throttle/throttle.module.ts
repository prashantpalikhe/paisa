/**
 * # Throttle Module
 *
 * Global rate limiting using @nestjs/throttler.
 *
 * ## How it works
 *
 * A single "default" throttle tier is registered globally:
 * - **All endpoints**: 100 requests per 60 seconds per IP
 *
 * Sensitive endpoints (login, register, password reset) override this
 * with `@StrictThrottle()` which lowers it to 10 requests per 60 seconds.
 *
 * ## Skipping rate limits
 *
 * Use `@SkipThrottle()` from `@nestjs/throttler` to exempt specific
 * endpoints (e.g., webhooks that come from Stripe's servers).
 *
 * ## Test environment
 *
 * In test mode (`NODE_ENV=test`), limits are raised to 1000/min to avoid
 * interfering with e2e test suites that fire many requests.
 *
 * ## Storage
 *
 * Uses in-memory storage by default. When Redis is enabled,
 * switch to `ThrottlerStorageRedisService` for multi-instance support.
 */
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: isTest ? 1000 : 100,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class ThrottleModule {}
