/**
 * # Email Module
 *
 * Always-loaded module that handles transactional emails.
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
 * Uses `DynamicModule` with a static `register()` method so the
 * provider can be chosen based on runtime config.
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
