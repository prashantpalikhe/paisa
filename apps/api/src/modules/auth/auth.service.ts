/**
 * # Auth Service
 *
 * Orchestrates all authentication flows. This is the "brain" of auth —
 * it coordinates between UserService, TokenService, and EventBus.
 *
 * ## Architecture
 *
 * ```
 * ┌───────────────────────────────────────────────────────────────┐
 * │                     Auth Service                              │
 * │                                                               │
 * │  register() ──┬──▶ UserService.create()                       │
 * │               ├──▶ TokenService.generateAccessToken()          │
 * │               ├──▶ TokenService.generateRefreshToken()         │
 * │               ├──▶ Generate email verification token           │
 * │               └──▶ EventBus.emit('user.registered')           │
 * │                                                               │
 * │  login() ─────┬──▶ (LocalStrategy already validated user)     │
 * │               ├──▶ TokenService.generateAccessToken()          │
 * │               ├──▶ TokenService.generateRefreshToken()         │
 * │               └──▶ EventBus.emit('user.logged_in')            │
 * │                                                               │
 * │  refresh() ───┬──▶ TokenService.rotateRefreshToken()           │
 * │               └──▶ Returns new access + refresh tokens         │
 * │                                                               │
 * │  logout() ────┬──▶ TokenService.revokeTokenFamily()            │
 * │               └──▶ Clear refresh cookie                        │
 * │                                                               │
 * │  verifyEmail() ──▶ Validate token → UserService.markVerified() │
 * │                                                               │
 * │  forgotPassword() ──▶ Generate reset token → emit event        │
 * │                                                               │
 * │  resetPassword() ──▶ Validate token → UserService.updatePwd()  │
 * │                   └──▶ TokenService.revokeAllUserTokens()      │
 * └───────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Verification & Reset Tokens
 *
 * Email verification and password reset tokens follow a secure pattern:
 *
 * 1. Generate a random token (32 bytes → 64 hex chars)
 * 2. Hash it with SHA-256
 * 3. Store the hash + metadata (userId, type, expiry) via TokenStore
 * 4. Send the RAW token to the user (via email link)
 * 5. When the user submits the token, hash it and look up the stored hash
 *
 * This way, even if the store is compromised, the stored hashes
 * can't be used to verify emails or reset passwords.
 *
 * Token storage is abstracted behind the TokenStore interface:
 * - MemoryTokenStore: In-memory Map (single server, development)
 * - RedisTokenStore: Redis-backed with automatic TTL (multi-server, production)
 *
 * The RedisModule provides the correct implementation based on the
 * FEATURE_REDIS_ENABLED flag. AuthService doesn't know or care which one.
 */
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { UserService } from '../user/user.service';
import { TokenService, type TokenPair } from './token.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { TOKEN_STORE } from '../redis';
import type { TokenStore, StoredToken } from '../redis';
import { DOMAIN_EVENTS } from '@paisa/shared';
import type { User } from '@paisa/db';
import type { OAuthProfile } from '@paisa/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBusService,
    @Inject(TOKEN_STORE) private readonly tokenStore: TokenStore,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Register a new user with email and password.
   *
   * Flow:
   * 1. Check if email already exists → ConflictException
   * 2. Create user (password hashed by UserService)
   * 3. Generate access + refresh tokens
   * 4. Generate email verification token
   * 5. Emit user.registered event (email module listens in Phase 4)
   * 6. Return tokens (controller sets the refresh cookie)
   */
  async register(
    email: string,
    password: string,
    name?: string,
    req?: { userAgent?: string; ip?: string },
  ): Promise<{ user: User; tokenPair: TokenPair; verificationToken: string }> {
    // Check for existing user
    const existing = await this.userService.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Create the user (password is hashed inside UserService)
    const user = await this.userService.create({ email, password, name });

    // Generate authentication tokens
    const { accessToken, expiresIn } =
      this.tokenService.generateAccessToken(user);
    const refreshToken = await this.tokenService.generateRefreshToken(
      user,
      null, // New login → new family
      req,
    );

    // Generate email verification token
    const verificationToken = await this.createVerificationToken(
      user.id,
      'email_verification',
      24 * 60 * 60 * 1000, // 24 hours
    );

    // Emit event — email module sends the verification email
    // For now, it's a no-op (nobody is listening), but the event is emitted
    // so the architecture is ready.
    this.eventBus.emit(DOMAIN_EVENTS.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      name: user.name,
      verificationToken,
    });

    this.logger.log(`User registered: ${user.id} (${user.email})`);

    return {
      user,
      tokenPair: { accessToken, expiresIn, refreshToken },
      verificationToken,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Login an already-validated user (LocalStrategy did the validation).
   *
   * Flow:
   * 1. Generate access + refresh tokens
   * 2. Emit user.logged_in event
   * 3. Return tokens (controller sets the refresh cookie)
   *
   * Note: By the time this method runs, Passport's LocalStrategy
   * has already verified the email and password. The `user` parameter
   * is the validated user from the database.
   */
  async login(
    user: User,
    req?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair> {
    const { accessToken, expiresIn } =
      this.tokenService.generateAccessToken(user);
    const refreshToken = await this.tokenService.generateRefreshToken(
      user,
      null, // New login → new family
      req,
    );

    this.eventBus.emit(DOMAIN_EVENTS.USER_LOGGED_IN, {
      userId: user.id,
      email: user.email,
    });

    this.logger.log(`User logged in: ${user.id} (${user.email})`);

    return { accessToken, expiresIn, refreshToken };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFRESH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Refresh the access token using a refresh token from the httpOnly cookie.
   *
   * Delegates to TokenService.rotateRefreshToken() which handles:
   * - Token validation
   * - Replay attack detection
   * - Token rotation (revoke old, issue new)
   */
  async refresh(
    rawRefreshToken: string,
    req?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair> {
    const { tokenPair } = await this.tokenService.rotateRefreshToken(
      rawRefreshToken,
      req,
    );
    return tokenPair;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGOUT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Logout the user by revoking their refresh token family.
   *
   * The controller also clears the httpOnly cookie.
   * The access token can't be revoked (it's stateless) — it will
   * naturally expire in ≤15 minutes.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;

    try {
      await this.tokenService.revokeByRawToken(rawRefreshToken);
    } catch (error) {
      // Logout should never fail from the user's perspective.
      // If the token is already invalid, that's fine — they're logged out.
      this.logger.warn('Error during logout token revocation:', error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL VERIFICATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Verify a user's email address using the token from the verification link.
   *
   * Flow:
   * 1. Hash the submitted token
   * 2. Look it up in the token store
   * 3. Check type, expiry, and existence
   * 4. Mark the user's email as verified
   * 5. Delete the used token
   * 6. Emit user.verified_email event
   */
  async verifyEmail(token: string): Promise<User> {
    const stored = await this.validateAndConsumeToken(token, 'email_verification');

    const user = await this.userService.markEmailVerified(stored.userId);

    this.eventBus.emit(DOMAIN_EVENTS.USER_VERIFIED_EMAIL, {
      userId: user.id,
      email: user.email,
    });

    this.logger.log(`Email verified for user: ${user.id}`);
    return user;
  }

  /**
   * Resend the email verification token.
   * Generates a new token and emits the event again.
   */
  async resendVerificationEmail(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    const verificationToken = await this.createVerificationToken(
      user.id,
      'email_verification',
      24 * 60 * 60 * 1000, // 24 hours
    );

    // Use VERIFICATION_RESENT (not USER_REGISTERED) so the email module
    // sends a "verify your email" email, not a "welcome" email.
    this.eventBus.emit(DOMAIN_EVENTS.USER_VERIFICATION_RESENT, {
      userId: user.id,
      email: user.email,
      name: user.name,
      verificationToken,
    });

    return verificationToken;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSWORD RESET
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Initiate a password reset by generating a reset token.
   *
   * Security: ALWAYS return success, even if the email doesn't exist.
   * This prevents attackers from discovering which emails are registered.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Don't reveal that the email doesn't exist
      this.logger.debug(
        `Password reset requested for non-existent email: ${email}`,
      );
      return;
    }

    // Generate a password reset token (1 hour TTL)
    const resetToken = await this.createVerificationToken(
      user.id,
      'password_reset',
      60 * 60 * 1000, // 1 hour
    );

    // Emit event — email module sends the reset email in Phase 4
    this.eventBus.emit(DOMAIN_EVENTS.USER_PASSWORD_RESET_REQUESTED, {
      userId: user.id,
      email: user.email,
      name: user.name,
      resetToken,
    });

    this.logger.log(`Password reset requested for user: ${user.id}`);
  }

  /**
   * Reset a user's password using the token from the reset email.
   *
   * Flow:
   * 1. Validate and consume the reset token
   * 2. Hash and store the new password
   * 3. Revoke ALL refresh tokens (force re-login on all devices)
   * 4. Emit user.password_changed event
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.validateAndConsumeToken(token, 'password_reset');

    // Look up the user so we can include email in the event payload.
    // The email module needs this to send the "password changed" notification
    // without having to query the database itself.
    const user = await this.userService.findById(stored.userId);

    // Update the password
    await this.userService.updatePassword(stored.userId, newPassword);

    // Revoke all sessions — user must re-login everywhere
    await this.tokenService.revokeAllUserTokens(stored.userId);

    this.eventBus.emit(DOMAIN_EVENTS.USER_PASSWORD_CHANGED, {
      userId: stored.userId,
      email: user?.email,
      name: user?.name,
    });

    this.logger.log(`Password reset completed for user: ${stored.userId}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHANGE PASSWORD (authenticated)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Change password for an authenticated user.
   * Requires the current password for confirmation.
   *
   * After changing, all OTHER sessions are revoked (not the current one —
   * the user just proved they know both passwords).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isValid = await this.userService.verifyPassword(
      user,
      currentPassword,
    );
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update to new password
    await this.userService.updatePassword(userId, newPassword);

    // Revoke all refresh tokens — force re-login on other devices
    // The current session's access token is still valid for ≤15 min,
    // and the frontend can immediately refresh with the new cookie.
    await this.tokenService.revokeAllUserTokens(userId);

    this.eventBus.emit(DOMAIN_EVENTS.USER_PASSWORD_CHANGED, {
      userId,
      email: user.email,
      name: user.name,
    });

    this.logger.log(`Password changed for user: ${userId}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SET PASSWORD (OAuth-only users)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Set a password for an OAuth-only user who doesn't have one yet.
   *
   * This is for users who signed up via Google OAuth and have
   * `passwordHash: null`. They're already authenticated (JWT guard),
   * so no current password is needed — they proved identity via OAuth.
   *
   * Guards:
   * - User must exist
   * - User must NOT have a password already (use changePassword for that)
   */
  async setPassword(userId: string, password: string): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordHash) {
      throw new ConflictException(
        'You already have a password. Use change password instead.',
      );
    }

    await this.userService.updatePassword(userId, password);

    this.eventBus.emit(DOMAIN_EVENTS.USER_PASSWORD_CHANGED, {
      userId,
      email: user.email,
      name: user.name,
    });

    this.logger.log(`Password set for OAuth user: ${userId}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OAUTH LOGIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Handle login/registration via an OAuth provider (e.g., Google).
   *
   * Called by the OAuth Passport strategy after the provider callback.
   * Delegates to UserService.findOrCreateOAuthUser() for the find-or-create
   * + account linking logic, then generates tokens and emits events.
   *
   * Flow:
   * 1. Find or create the user (+ link OAuth account if needed)
   * 2. Check if the user is banned
   * 3. Generate access + refresh tokens
   * 4. Emit the appropriate event (registered vs logged_in vs oauth_linked)
   * 5. Return tokens + user (controller handles the redirect)
   */
  async handleOAuthLogin(
    profile: OAuthProfile,
    req?: { userAgent?: string; ip?: string },
  ): Promise<{ user: User; tokenPair: TokenPair; isNewUser: boolean }> {
    // Find or create the user (handles all 3 scenarios: returning, linking, new)
    const { user, isNewUser } =
      await this.userService.findOrCreateOAuthUser(profile);

    // Check if the account is banned
    if (user.banned) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    // Generate authentication tokens
    const { accessToken, expiresIn } =
      this.tokenService.generateAccessToken(user);
    const refreshToken = await this.tokenService.generateRefreshToken(
      user,
      null, // New OAuth login → new family
      req,
    );

    // Emit the right event so downstream modules (email, analytics) can react
    if (isNewUser) {
      this.eventBus.emit(DOMAIN_EVENTS.USER_REGISTERED, {
        userId: user.id,
        email: user.email,
        name: user.name,
        oauthProvider: profile.provider,
      });
      this.logger.log(
        `New user registered via ${profile.provider}: ${user.id}`,
      );
    } else {
      this.eventBus.emit(DOMAIN_EVENTS.USER_LOGGED_IN, {
        userId: user.id,
        email: user.email,
        oauthProvider: profile.provider,
      });
      this.logger.log(
        `User logged in via ${profile.provider}: ${user.id}`,
      );
    }

    return {
      user,
      tokenPair: { accessToken, expiresIn, refreshToken },
      isNewUser,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRIVATE: TOKEN STORE HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Create a verification or reset token.
   * Returns the RAW token (to be sent to the user via email).
   * Stores the HASH in the token store (for later validation).
   */
  private async createVerificationToken(
    userId: string,
    type: StoredToken['type'],
    ttlMs: number,
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');

    await this.tokenStore.set(
      hash,
      { userId, type, expiresAt: new Date(Date.now() + ttlMs) },
      ttlMs,
    );

    return rawToken;
  }

  /**
   * Validate a token, check its type and expiry, and delete it (single-use).
   * Throws UnauthorizedException if invalid.
   */
  private async validateAndConsumeToken(
    rawToken: string,
    expectedType: StoredToken['type'],
  ): Promise<StoredToken> {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.tokenStore.get(hash);

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (stored.type !== expectedType) {
      throw new UnauthorizedException('Invalid token type');
    }

    if (stored.expiresAt < new Date()) {
      await this.tokenStore.delete(hash);
      throw new UnauthorizedException('Token has expired');
    }

    // Consume the token (single-use)
    await this.tokenStore.delete(hash);

    return stored;
  }

}
