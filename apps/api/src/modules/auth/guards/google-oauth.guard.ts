/**
 * # Google OAuth Guard
 *
 * Extends Passport's AuthGuard('google') with a feature flag check.
 *
 * If `FEATURE_AUTH_GOOGLE_ENABLED` is false, returns 404 immediately —
 * the Google strategy is never invoked. This keeps the endpoints invisible
 * when Google OAuth is not configured.
 *
 * ## Why not just use AuthGuard('google') directly?
 *
 * If the feature flag is off but someone hits /auth/google, Passport would
 * try to redirect to Google with dummy credentials and fail with a confusing
 * error. This guard catches that early and returns a clean 404.
 */
import {
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppConfigService } from '../../../core/config/config.service';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  /**
   * Check the feature flag before delegating to Passport.
   * If disabled, throw 404 (endpoint doesn't exist from the client's perspective).
   */
  canActivate(context: ExecutionContext) {
    if (!this.config.features.auth.google.enabled) {
      throw new NotFoundException(
        'Google OAuth is not enabled. Set FEATURE_AUTH_GOOGLE_ENABLED=true to enable it.',
      );
    }

    return super.canActivate(context);
  }
}
