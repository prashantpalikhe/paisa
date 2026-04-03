/**
 * # Token Service
 *
 * Manages JWT access tokens and refresh tokens (with rotation).
 *
 * ## Token Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        TOKEN FLOW                               │
 * │                                                                 │
 * │  Login/Register                                                 │
 * │       │                                                         │
 * │       ▼                                                         │
 * │  ┌──────────────┐    ┌───────────────────┐                      │
 * │  │ Access Token  │    │  Refresh Token     │                     │
 * │  │              │    │                   │                      │
 * │  │ Where: Memory│    │ Where: httpOnly   │                      │
 * │  │  (frontend)  │    │  cookie (browser) │                      │
 * │  │              │    │                   │                      │
 * │  │ Lifetime:    │    │ Lifetime: 7 days  │                      │
 * │  │  15 minutes  │    │                   │                      │
 * │  │              │    │ Stored in DB:     │                      │
 * │  │ Contains:    │    │  SHA-256 hash     │                      │
 * │  │  userId      │    │  (never raw)      │                      │
 * │  │  email       │    │                   │                      │
 * │  │  role        │    │ Has a "family"    │                      │
 * │  └──────┬───────┘    │  for replay       │                      │
 * │         │            │  detection        │                      │
 * │         │            └─────────┬─────────┘                      │
 * │         │                      │                                │
 * │         ▼                      ▼                                │
 * │  Sent in header:         Sent in cookie:                        │
 * │  Authorization: Bearer   refresh_token=xxx; HttpOnly; Secure    │
 * │                                                                 │
 * │  When access token expires (15 min):                            │
 * │       │                                                         │
 * │       ▼                                                         │
 * │  POST /auth/refresh (cookie sent automatically)                 │
 * │       │                                                         │
 * │       ▼                                                         │
 * │  Old refresh token → REVOKED                                    │
 * │  New refresh token → Issued (same family)                       │
 * │  New access token  → Returned                                   │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Why refresh token ROTATION?
 *
 * Without rotation: If an attacker steals a refresh token, they can
 * use it forever (until it expires in 7 days).
 *
 * With rotation: Each refresh token is single-use. When you use it,
 * a new one is issued and the old one is revoked. If an attacker
 * uses a stolen token, either:
 *
 * 1. **Attacker uses it first** → Real user's token is now invalid →
 *    Real user tries to refresh → Fails → Whole family revoked →
 *    Attacker's new token is also revoked
 *
 * 2. **Real user uses it first** → Attacker's stolen token is revoked →
 *    Attacker can't use it
 *
 * The "family" field tracks which tokens descended from the same login.
 * If we detect a revoked token being reused, we revoke the ENTIRE family.
 *
 * ## Why store only the HASH in the database?
 *
 * Same reason we hash passwords: if the database is breached, attackers
 * get hashes — not usable tokens. We use SHA-256 (not argon2) because:
 * - Refresh tokens are high-entropy random strings (not human passwords)
 * - They don't need memory-hard hashing (no dictionary attacks possible)
 * - SHA-256 is fast, which matters when we verify on every refresh
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { DatabaseService } from '../../core/database/database.service';
import { AppConfigService } from '../../core/config/config.service';
import type { User } from '@paisa/db';

/** What's inside the JWT access token payload */
export interface JwtPayload {
  /** Subject — the user's ID */
  sub: string;
  /** User's email */
  email: string;
  /** User's role (USER or ADMIN) */
  role: string;
  /** Issued at (Unix timestamp) — added automatically by JWT */
  iat?: number;
  /** Expiration (Unix timestamp) — added automatically by JWT */
  exp?: number;
}

/** Returned to the client after login/register/refresh */
export interface TokenPair {
  /** JWT access token (sent in Authorization header) */
  accessToken: string;
  /** Seconds until the access token expires */
  expiresIn: number;
  /** Raw refresh token (set as httpOnly cookie, NEVER sent in response body) */
  refreshToken: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACCESS TOKENS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Generate a JWT access token for a user.
   *
   * The token contains just enough data to identify the user and their role.
   * We intentionally keep the payload small — JWTs are sent with every request.
   * Full user data is fetched from the DB when needed (via JwtStrategy).
   */
  generateAccessToken(user: User): { accessToken: string; expiresIn: number } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload);

    // Parse the expiry config (e.g., "15m" → 900 seconds)
    const expiresIn = this.parseExpiryToSeconds(
      this.config.env.JWT_ACCESS_EXPIRY,
    );

    return { accessToken, expiresIn };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFRESH TOKENS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Generate a new refresh token and store its hash in the database.
   *
   * @param user - The user this token belongs to
   * @param family - Token family ID. Pass null for a NEW login (creates a new family).
   *                 Pass existing family ID when rotating (refresh flow).
   * @param req - Optional request metadata for session tracking
   */
  async generateRefreshToken(
    user: User,
    family: string | null,
    req?: { userAgent?: string; ip?: string },
  ): Promise<string> {
    // Generate a cryptographically secure random token (64 bytes → 128 hex chars)
    // This is NOT a JWT — it's a random opaque string. The server looks it up in the DB.
    const rawToken = randomBytes(64).toString('hex');

    // Hash the token before storing. If the DB is breached, attackers get hashes, not tokens.
    const tokenHash = this.hashToken(rawToken);

    // Create a new family if this is a fresh login
    const tokenFamily = family ?? randomBytes(16).toString('hex');

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() +
        this.parseExpiryToSeconds(this.config.env.JWT_REFRESH_EXPIRY) * 1000,
    );

    // Store in database
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family: tokenFamily,
        expiresAt,
        userAgent: req?.userAgent ?? null,
        ipAddress: req?.ip ?? null,
      },
    });

    return rawToken;
  }

  /**
   * Validate a refresh token and rotate it (issue a new one, revoke the old).
   *
   * This is the core of the refresh flow:
   * 1. Hash the incoming token
   * 2. Look it up in the database
   * 3. Check if it's been revoked (replay attack detection)
   * 4. Check if it's expired
   * 5. Revoke the old token
   * 6. Issue a new token in the same family
   *
   * Returns both the new tokens and the user.
   */
  async rotateRefreshToken(
    rawToken: string,
    req?: { userAgent?: string; ip?: string },
  ): Promise<{ user: User; tokenPair: TokenPair }> {
    const tokenHash = this.hashToken(rawToken);

    // Find the stored token by its hash
    const storedToken = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      // Token not found — either invalid or already used (rotation means old tokens are deleted)
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ── Replay attack detection ──
    // If the token was already revoked, someone is trying to reuse it.
    // This means BOTH the attacker and the real user have the token.
    // Revoke the entire family to force everyone to re-login.
    if (storedToken.revokedAt) {
      this.logger.warn(
        `Refresh token replay detected for family: ${storedToken.family}, user: ${storedToken.userId}`,
      );
      await this.revokeTokenFamily(storedToken.family);
      throw new UnauthorizedException(
        'Refresh token has been revoked — please log in again',
      );
    }

    // ── Expiry check ──
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // ── Check user is not banned ──
    if (storedToken.user.banned) {
      await this.revokeTokenFamily(storedToken.family);
      throw new UnauthorizedException('Account has been suspended');
    }

    // ── Rotate: revoke old token, issue new one ──
    await this.db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens (same family — descendant of the same login)
    const { accessToken, expiresIn } = this.generateAccessToken(
      storedToken.user,
    );
    const refreshToken = await this.generateRefreshToken(
      storedToken.user,
      storedToken.family, // Same family — tracks the lineage
      req,
    );

    return {
      user: storedToken.user,
      tokenPair: { accessToken, expiresIn, refreshToken },
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REVOCATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Revoke all tokens in a family.
   * Used when:
   * - Replay attack detected
   * - User explicitly logs out
   * - Password is changed/reset
   */
  async revokeTokenFamily(family: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke ALL refresh tokens for a user.
   * Used when:
   * - Password is reset (force re-login on all devices)
   * - User is banned
   * - User clicks "logout everywhere"
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`All refresh tokens revoked for user: ${userId}`);
  }

  /**
   * Revoke a refresh token (and its entire family) given the raw token.
   * Used by the logout flow.
   */
  async revokeByRawToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const storedToken = await this.db.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken && !storedToken.revokedAt) {
      await this.revokeTokenFamily(storedToken.family);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Hash a token with SHA-256.
   *
   * Why SHA-256 and not Argon2?
   * - Refresh tokens are random 64-byte strings (high entropy)
   * - No risk of dictionary/rainbow table attacks
   * - SHA-256 is fast — important since we hash on every refresh request
   * - Argon2 is for LOW-entropy secrets (human-chosen passwords)
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse a duration string like "15m", "7d", "1h" to seconds.
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid expiry format: "${expiry}". Use e.g. "15m", "7d".`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * multipliers[unit];
  }
}
