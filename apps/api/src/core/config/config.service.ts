import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseEnv, parseFeatures } from '@paisa/config';
import type { Env, Features } from '@paisa/config';

/**
 * # App Config Service
 *
 * Typed, validated access to all configuration.
 * Wraps NestJS ConfigService with Zod validation.
 *
 * ## Usage
 *
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private config: AppConfigService) {}
 *
 *   doSomething() {
 *     const port = this.config.env.API_PORT;
 *     if (this.config.features.stripe.enabled) {
 *       // Stripe-specific code
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  /** Validated core environment variables */
  public readonly env: Env;

  /** Validated feature flags */
  public readonly features: Features;

  constructor(private configService: ConfigService) {
    // Validate core env vars
    this.env = parseEnv(this.getAllEnvVars());

    // Validate feature flags
    this.features = parseFeatures(this.getAllEnvVars());

    this.logConfiguration();
  }

  /** Whether the app is running in production */
  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  /** Whether the app is running in development */
  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  /** Whether the app is running in test */
  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  /**
   * Determines the cookie SameSite policy based on environment.
   * - Production: 'lax' (same domain)
   * - Preview (cross-site): 'none' (requires Secure)
   * - Development: 'lax'
   */
  get cookieSameSite(): 'strict' | 'lax' | 'none' {
    if (this.isDevelopment || this.isTest) return 'lax';

    // If frontend and API are on different sites, use 'none'
    const frontendHost = new URL(this.env.FRONTEND_URL).hostname;
    const apiHost = new URL(this.env.API_BASE_URL).hostname;

    // Extract root domain (e.g., "myapp.com" from "api.myapp.com")
    const frontendRoot = frontendHost.split('.').slice(-2).join('.');
    const apiRoot = apiHost.split('.').slice(-2).join('.');

    if (frontendRoot !== apiRoot) {
      return 'none'; // cross-site (preview environments)
    }

    return 'lax'; // same-site (production with shared domain)
  }

  /** CORS allowed origins */
  get corsOrigins(): string[] {
    return [this.env.FRONTEND_URL, this.env.ADMIN_URL].filter(Boolean);
  }

  /** Get a raw env var (escape hatch) */
  get<T = string>(key: string): T | undefined {
    return this.configService.get<T>(key);
  }

  private getAllEnvVars(): Record<string, string | undefined> {
    return process.env as Record<string, string | undefined>;
  }

  private logConfiguration(): void {
    this.logger.log(`Environment: ${this.env.NODE_ENV}`);
    this.logger.log(`API Port: ${this.env.API_PORT}`);
    this.logger.log(`Features enabled:`);

    const featureStatus = {
      'Auth - Google': this.features.auth.google.enabled,
      'Auth - Passkey': this.features.auth.passkey.enabled,
      'Auth - 2FA': this.features.auth.twoFactor.enabled,
      Stripe: this.features.stripe.enabled,
      Redis: this.features.redis.enabled,
      RabbitMQ: this.features.rabbitmq.enabled,
      WebSockets: this.features.websockets.enabled,
      Sentry: this.features.sentry.enabled,
    };

    for (const [name, enabled] of Object.entries(featureStatus)) {
      this.logger.log(`  ${enabled ? '✓' : '✗'} ${name}`);
    }
  }
}
