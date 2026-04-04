/**
 * # Public Config Controller
 *
 * Exposes client-safe configuration to the frontend.
 *
 * The frontend can't read backend env vars directly, and it deploys
 * independently. So it fetches this endpoint once on startup to learn
 * which features are available (Google OAuth, passkeys, Stripe, etc.)
 * and conditionally shows/hides UI.
 *
 * ## Security
 *
 * This endpoint is @Public() — no auth required. It only exposes
 * boolean flags (enabled/disabled), never secrets or credentials.
 *
 * ## What's NOT here
 *
 * Backend-only features (Redis, RabbitMQ, Sentry) aren't exposed
 * because the frontend doesn't need to know about them.
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfigService } from './config.service';

interface PublicConfig {
  auth: {
    google: boolean;
    passkey: boolean;
    twoFactor: boolean;
  };
  features: {
    stripe: boolean;
  };
}

@ApiTags('Config')
@Controller('config')
export class PublicConfigController {
  constructor(private readonly config: AppConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get client-safe configuration (feature flags)' })
  getPublicConfig(): PublicConfig {
    return {
      auth: {
        google: this.config.features.auth.google.enabled,
        passkey: this.config.features.auth.passkey.enabled,
        twoFactor: this.config.features.auth.twoFactor.enabled,
      },
      features: {
        stripe: this.config.features.stripe.enabled,
      },
    };
  }
}
