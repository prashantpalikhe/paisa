/**
 * Shared helpers used by both AuthController and PasskeyController.
 */
import { Response } from 'express';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AppConfigService } from '../../core/config/config.service';
import type { AuthUser } from '@paisa/shared';
import type { User } from '@paisa/db';

/**
 * Set the refresh token as an httpOnly cookie.
 *
 * Cookie settings:
 * - httpOnly: true   → JavaScript can't read it (XSS protection)
 * - secure: true     → Only sent over HTTPS (except in dev)
 * - sameSite: varies → Depends on environment (see AppConfigService)
 * - path: /          → Sent with all requests to this domain
 * - maxAge: 7d       → Matches refresh token TTL
 */
export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  config: AppConfigService,
): void {
  const maxAgeMs = parseExpiryToMs(config.env.JWT_REFRESH_EXPIRY);

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: !config.isDevelopment,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: maxAgeMs,
  });
}

/**
 * Convert a Prisma User to the AuthUser shape shared with the frontend.
 *
 * @param hasPasskey - Whether the user has registered passkeys.
 *   Pass explicitly to avoid an extra DB query when the value is already known.
 */
export function toAuthUser(user: User, hasPasskey: boolean): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'USER' | 'ADMIN',
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    hasPassword: !!user.passwordHash,
    has2FA: false, // Phase 3
    hasPasskey,
  };
}

/** Parse "7d", "15m", etc. to milliseconds. */
export function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

  const value = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return value * multipliers[match[2]];
}
