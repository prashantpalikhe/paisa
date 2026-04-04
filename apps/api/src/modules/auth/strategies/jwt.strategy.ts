/**
 * # JWT Strategy (Passport)
 *
 * Validates JWT access tokens on every authenticated request.
 *
 * ## How it works
 *
 * ```
 * Any request with Authorization: Bearer <token>
 *       │
 *       ▼
 * JwtAuthGuard (triggers Passport)
 *       │
 *       ▼
 * JWT Strategy extracts token from header
 *       │
 *       ▼
 * Verifies signature using JWT_SECRET
 *       │
 *       ├── Invalid/expired? → 401 Unauthorized
 *       │
 *       ▼
 * JwtStrategy.validate(payload) called with decoded payload
 *       │
 *       ▼
 * Fetches full user from DB (to get latest role, ban status, etc.)
 *       │
 *       ▼
 * Returns AuthUser → attached to request.user
 * ```
 *
 * ## Why fetch the user from DB on every request?
 *
 * The JWT payload contains the user's role at the time of token creation.
 * But roles can change (admin demotes user, user gets banned).
 * If we only used the JWT payload, a banned user could keep accessing
 * the API until their token expires (up to 15 minutes).
 *
 * By fetching from DB, we get the CURRENT state. The tradeoff is one
 * extra DB query per request — but it's a primary key lookup (fast)
 * and gives us real-time ban/role enforcement.
 *
 * When Redis is enabled (Phase 8), we'll cache this lookup.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../../core/config/config.service';
import { UserService } from '../../user/user.service';
import { PasskeyService } from '../passkey.service';
import type { JwtPayload } from '../token.service';
import type { AuthUser } from '@paisa/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly userService: UserService,
    private readonly passkeyService: PasskeyService,
  ) {
    super({
      // Extract the JWT from the Authorization header: "Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens (handled by passport-jwt, no manual check needed)
      ignoreExpiration: false,

      // The secret used to verify the JWT signature
      secretOrKey: config.env.JWT_SECRET,
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   * The `payload` parameter is the decoded JWT body.
   *
   * Returns an AuthUser object that becomes `request.user`.
   * This is the shape that @CurrentUser() decorator returns.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Fetch the full user from the database to get current state
    const user = await this.userService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.banned) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    // Check if user has passkeys registered
    const hasPasskey = await this.passkeyService.hasPasskey(user.id);

    // Return the AuthUser shape (shared between frontend and backend)
    // This is what controllers receive via @CurrentUser()
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'USER' | 'ADMIN',
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      has2FA: false, // Phase 3
      hasPasskey,
    };
  }
}
