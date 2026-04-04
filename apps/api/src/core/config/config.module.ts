import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnvFromRoot } from '@paisa/config';
import { AppConfigService } from './config.service';
import { PublicConfigController } from './public-config.controller';

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

// Load .env from the monorepo root BEFORE NestJS ConfigModule reads process.env.
// Uses the shared `loadEnvFromRoot()` utility which finds the root by walking
// up to turbo.json. This replaces the fragile `../../.env` path.
loadEnvFromRoot();

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // We already loaded .env above via loadEnvFromRoot().
      // Tell NestJS ConfigModule to NOT load .env files itself —
      // we handle it to ensure .env.local priority and monorepo root detection.
      ignoreEnvFile: true,
    }),
  ],
  controllers: [PublicConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class CoreConfigModule {}
