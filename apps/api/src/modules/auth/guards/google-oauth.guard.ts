/**
 * # Google OAuth Guard
 *
 * Extends Passport's AuthGuard('google') with:
 * 1. Feature flag check — returns 404 if Google OAuth is disabled
 * 2. Error handling — on callback failure, redirects to frontend with error
 *    instead of returning a JSON error response
 *
 * ## Why override handleRequest?
 *
 * When Passport's strategy calls `done(error)`, the default AuthGuard
 * re-throws the error. That error hits GlobalExceptionFilter, which
 * returns JSON: `{ error: { code: "INTERNAL_ERROR" } }`.
 *
 * But the Google callback is a browser redirect flow, not an API call.
 * The user sees a JSON error page instead of being redirected back to
 * the frontend with a friendly error. By overriding handleRequest, we
 * catch Passport errors and redirect to the frontend's error page.
 */
import {
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppConfigService } from '../../../core/config/config.service';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleOAuthGuard.name);

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

  /**
   * Override handleRequest to handle Passport errors gracefully.
   *
   * Passport's AuthGuard calls this after the strategy finishes.
   * The default implementation throws the error, which reaches the
   * GlobalExceptionFilter and returns JSON. We redirect instead.
   *
   * When err is set OR user is null, that means the OAuth flow failed
   * (token exchange error, user denied consent, strategy threw, etc).
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      this.logger.error(
        'Google OAuth callback failed',
        err?.stack || err?.message || info?.message || 'Unknown error',
      );

      // Redirect to frontend with error parameter
      const frontendUrl = this.config.env.FRONTEND_URL;
      const response = context.switchToHttp().getResponse();
      const errorUrl = new URL('/auth/callback', frontendUrl);
      errorUrl.searchParams.set('error', 'oauth_failed');
      response.redirect(errorUrl.toString());

      // Throw to prevent the controller handler from running.
      // This exception will be caught by GlobalExceptionFilter,
      // but the response is already sent (redirect), so it's a no-op.
      throw new UnauthorizedException('OAuth failed');
    }

    return user;
  }
}
