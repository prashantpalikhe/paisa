import { Module } from '@nestjs/common';
import { parseFeatures } from '@paisa/config';
import { CoreConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { LoggingModule } from './core/logging/logging.module';
import { HealthModule } from './core/health/health.module';
import { EventBusModule } from './common/event-bus/event-bus.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { EmailModule } from './modules/email/email.module';
import { TestModule } from './test/test.module';

/**
 * # App Module
 *
 * Root module of the NestJS application.
 *
 * ## Module loading order
 *
 * 1. **Always loaded**: Config, Database, Logging, Health, EventBus
 * 2. **Always loaded**: Auth, User (core domain modules)
 * 3. **Conditionally loaded**: Email, Stripe, Cache, Queue, Storage, WebSocket, Sentry
 *
 * ## How conditional loading works
 *
 * NestJS `@Module` decorators need static arrays — you can't use `if` inside them.
 * So we compute the optional modules BEFORE the decorator runs:
 *
 * 1. `parseFeatures(process.env)` reads the feature flags from env vars
 *    (already loaded by `loadEnvFromRoot()` in CoreConfigModule)
 * 2. We build an array of modules that should be loaded
 * 3. We spread that array into the imports
 *
 * This runs at module-evaluation time (when Node.js loads the file),
 * which is BEFORE NestJS bootstraps the dependency injection container.
 */

// ─── Compute optional modules at module-evaluation time ───
// This is safe because loadEnvFromRoot() runs before this file is evaluated.
const features = parseFeatures(process.env);

const optionalModules = [
  features.email.enabled && EmailModule.register(),
  // features.stripe.enabled    && StripeModule.register(),
  // features.redis.enabled     && CacheModule.register(),
  // features.rabbitmq.enabled  && QueueModule.register(),
  // features.storage.enabled   && StorageModule.register(),
  // features.websockets.enabled && WebsocketModule.register(),
  // features.sentry.enabled    && SentryModule.register(),
].filter(Boolean);

@Module({
  imports: [
    // ─── Always loaded (core infrastructure) ───
    CoreConfigModule,
    LoggingModule,
    DatabaseModule,
    EventBusModule,
    HealthModule,

    // ─── Always loaded (core domain) ───
    AuthModule,
    UserModule,

    // ─── Conditionally loaded (optional integrations) ───
    ...optionalModules,

    // ─── Test-only module (database reset, email inbox for Playwright) ───
    ...(process.env.NODE_ENV === 'test' ? [TestModule] : []),
  ],
})
export class AppModule {}
