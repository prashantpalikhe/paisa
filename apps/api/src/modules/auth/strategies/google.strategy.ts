/**
 * # Google OAuth Strategy (Passport)
 *
 * Handles the Google OAuth 2.0 authentication flow.
 *
 * ## How it works
 *
 * ```
 * GET /auth/google
 *       |
 *       v
 * GoogleOAuthGuard checks feature flag
 *       |
 *       v
 * Passport redirects browser to Google's consent screen
 *       |
 *       v (user grants consent)
 *       |
 * Google redirects to GET /auth/google/callback?code=xxx
 *       |
 *       v
 * Passport exchanges code for Google tokens
 *       |
 *       v
 * GoogleStrategy.validate() runs
 *       |  - Extracts email, name, avatar from Google profile
 *       |  - Calls AuthService.handleOAuthLogin()
 *       |  - Returns { user, tokenPair, isNewUser }
 *       v
 * Result attached to request.user
 *       |
 *       v
 * Controller callback method runs (redirects to frontend)
 * ```
 *
 * ## Why validate() returns the full result (not just the user)?
 *
 * The controller needs both the token pair AND the user to build the
 * redirect URL. By doing the heavy lifting in validate(), the controller
 * stays thin. Whatever validate() returns becomes request.user.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import type { Profile } from 'passport-google-oauth20';
import { AppConfigService } from '../../../core/config/config.service';
import { AuthService } from '../auth.service';
import type { OAuthProfile } from '@paisa/shared';

/** The shape that gets attached to request.user after Google OAuth */
export interface GoogleOAuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    emailVerified: boolean;
    avatarUrl: string | null;
  };
  tokenPair: {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  };
  isNewUser: boolean;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    const googleConfig = config.features.auth.google;

    // When the feature flag is disabled, Passport still needs valid constructor
    // args. We pass empty strings — the GoogleOAuthGuard prevents this strategy
    // from ever being invoked when disabled.
    super({
      clientID: googleConfig.clientId || 'disabled',
      clientSecret: googleConfig.clientSecret || 'disabled',
      callbackURL: googleConfig.callbackUrl || 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  /**
   * Called by Passport after Google returns the user's profile.
   *
   * Whatever this method returns becomes `request.user` in the controller.
   * We return the full OAuth result (user + tokens + isNewUser) so the
   * controller can build the redirect URL without extra service calls.
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      // Extract the fields we need from Google's profile
      const email = profile.emails?.[0]?.value;

      if (!email) {
        // Extremely rare — our scope requests 'email'. But handle it gracefully.
        throw new UnauthorizedException(
          'No email address returned from Google. Please ensure your Google account has a verified email.',
        );
      }

      const oauthProfile: OAuthProfile = {
        provider: 'google',
        providerUserId: profile.id,
        email,
        name: profile.displayName || undefined,
        avatarUrl: profile.photos?.[0]?.value || undefined,
        accessToken,
        refreshToken,
        // Google access tokens typically expire in 1 hour
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };

      // Delegate to AuthService — handles find/create/link + token generation
      const result = await this.authService.handleOAuthLogin(oauthProfile, {
        // req metadata not available in strategy — controller can add it if needed
      });

      // Pass the result to Passport (becomes request.user)
      done(null, result);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
