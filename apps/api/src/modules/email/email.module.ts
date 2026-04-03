/**
 * # Email Module
 *
 * Optional module — loaded ONLY when `FEATURE_EMAIL_ENABLED=true`.
 * Core modules (Auth) never import this. Communication is via EventBus.
 *
 * ## Provider selection (automatic, based on environment)
 *
 * | NODE_ENV      | Provider   | What happens                       |
 * |---------------|------------|------------------------------------|
 * | development   | Console    | Prints emails to terminal          |
 * | test          | InMemory   | Captures emails for test assertions|
 * | production    | Resend     | Sends real emails via Resend API   |
 *
 * ## Module registration
 *
 * Uses `DynamicModule` with a static `register()` method:
 *
 * ```typescript
 * // In AppModule
 * @Module({
 *   imports: [
 *     ...(features.email.enabled ? [EmailModule.register()] : []),
 *   ],
 * })
 * ```
 *
 * The `register()` pattern lets us configure the provider based on
 * runtime config without making the module itself complicated.
 *
 * ## Why not just import the module statically?
 *
 * Static imports can't be conditional. We need the feature flag check
 * to happen at module-evaluation time (before NestJS bootstraps).
 */
import { DynamicModule, Module } from '@nestjs/common';
import { AppConfigService } from '../../core/config/config.service';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { InMemoryEmailProvider } from './providers/in-memory-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { EmailEventListener } from './email-event.listener';

@Module({})
export class EmailModule {
  /**
   * Register the email module with the appropriate provider.
   *
   * The provider is chosen by a factory that reads the current environment:
   * - test → InMemoryEmailProvider (capture for assertions)
   * - development → ConsoleEmailProvider (print to terminal)
   * - production → ResendEmailProvider (real delivery)
   */
  static register(): DynamicModule {
    return {
      module: EmailModule,
      global: true, // Make EMAIL_PROVIDER available to all modules (e.g. TestModule)
      providers: [
        // The event listener — subscribes to domain events and sends emails
        EmailEventListener,

        // The email provider — selected based on environment
        {
          provide: EMAIL_PROVIDER,
          useFactory: (config: AppConfigService) => {
            if (config.isTest) {
              return new InMemoryEmailProvider();
            }

            if (config.isDevelopment) {
              return new ConsoleEmailProvider();
            }

            // Production — requires Resend config (validated by feature flag schema)
            return new ResendEmailProvider(
              config.features.email.apiKey!,
              config.features.email.fromAddress!,
            );
          },
          inject: [AppConfigService],
        },
      ],
      exports: [EMAIL_PROVIDER],
    };
  }
}
