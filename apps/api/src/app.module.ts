import { Module } from '@nestjs/common';
import { CoreConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { LoggingModule } from './core/logging/logging.module';
import { HealthModule } from './core/health/health.module';
import { EventBusModule } from './common/event-bus/event-bus.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';

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
 * Conditional modules are loaded based on feature flags from `AppConfigService`.
 * They are added in later phases (see ARCHITECTURE.md §28).
 */
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
    // Added in Phase 6-8 based on feature flags:
    // ...[
    //   features.email.enabled     && EmailModule.register(),
    //   features.stripe.enabled    && StripeModule.register(),
    //   features.redis.enabled     && CacheModule.register(),
    //   features.rabbitmq.enabled  && QueueModule.register(),
    //   features.storage.enabled   && StorageModule.register(),
    //   features.websockets.enabled && WebsocketModule.register(),
    //   features.sentry.enabled    && SentryModule.register(),
    // ].filter(Boolean),
  ],
})
export class AppModule {}
