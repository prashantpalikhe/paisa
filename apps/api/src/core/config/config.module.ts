import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';

/**
 * # Core Config Module
 *
 * Global module that loads and validates all environment variables at startup.
 * Provides `AppConfigService` for typed access to configuration throughout the app.
 *
 * ## How to enable features
 *
 * Set `FEATURE_*_ENABLED=true` in your `.env` file along with the required
 * configuration for that feature. See `.env.example` for all available options.
 *
 * The app will fail fast at startup if a feature is enabled but missing required
 * configuration. This prevents runtime surprises.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env files are loaded by NestJS ConfigModule
      // Feature flags and env validation happen in AppConfigService
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class CoreConfigModule {}
