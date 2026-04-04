/**
 * # User Service
 *
 * Core user operations: create, find, update, password verification.
 * This is a DOMAIN service — it manages the User entity.
 * It does NOT handle authentication (that's AuthService's job).
 *
 * ## Why separate from AuthService?
 *
 * ```
 * ┌──────────────────┐     ┌──────────────────┐
 * │   AuthService     │────▶│   UserService     │
 * │                   │     │                   │
 * │ • login()         │     │ • create()        │
 * │ • register()      │     │ • findByEmail()   │
 * │ • verifyEmail()   │     │ • findById()      │
 * │ • resetPassword() │     │ • updatePassword()│
 * │ • refreshToken()  │     │ • verifyPassword()│
 * └──────────────────┘     └──────────────────┘
 * ```
 *
 * AuthService orchestrates auth flows.
 * UserService owns user data operations.
 * If we added an admin "manage users" feature, it would also use UserService.
 *
 * ## Password Hashing: Argon2id
 *
 * We use Argon2id (not bcrypt) because:
 * - **Memory-hard**: Attackers need lots of RAM per guess (GPU attacks are expensive)
 * - **OWASP recommended**: The current best practice for password hashing
 * - **Three variants**: Argon2d (GPU-resistant), Argon2i (side-channel resistant),
 *   Argon2id (hybrid — what we use, best of both worlds)
 *
 * The `argon2` npm package handles salt generation automatically.
 * Each hash includes the algorithm, parameters, salt, and hash — all in one string.
 * Example: `$argon2id$v=19$m=65536,t=3,p=4$salt$hash`
 */
import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DatabaseService } from '../../core/database/database.service';
import type { User } from '@paisa/db';
import type { OAuthProfile } from '@paisa/shared';
import type { StorageProvider } from '../storage/providers/storage-provider.interface';

/** Fields needed to create a new user */
export interface CreateUserInput {
  email: string;
  password?: string; // Optional — OAuth users don't have passwords
  name?: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new user with an optional hashed password.
   *
   * Password is hashed with Argon2id before storage.
   * If no password is provided (OAuth registration), passwordHash is null.
   */
  async create(input: CreateUserInput): Promise<User> {
    const { email, password, name } = input;

    // Hash password if provided (email/password registration)
    // OAuth users won't have a password — they authenticate via provider
    const passwordHash = password ? await argon2.hash(password) : null;

    const user = await this.db.user.create({
      data: {
        email: email.toLowerCase().trim(), // Normalize email
        passwordHash,
        name: name?.trim() || null,
      },
    });

    this.logger.log(`User created: ${user.id} (${user.email})`);
    return user;
  }

  /**
   * Find a user by email address.
   * Returns null if not found (don't throw — let the caller decide the error).
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Find a user by ID.
   * Returns null if not found.
   */
  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { id },
    });
  }

  /**
   * Verify a plaintext password against a stored Argon2 hash.
   *
   * How Argon2 verification works:
   * 1. The stored hash contains the salt and algorithm parameters
   * 2. Argon2 re-hashes the plaintext with the SAME salt and parameters
   * 3. If the result matches, the password is correct
   *
   * Returns false if the user has no password (OAuth-only account).
   */
  async verifyPassword(user: User, plainPassword: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false; // OAuth-only users can't log in with a password
    }

    return argon2.verify(user.passwordHash, plainPassword);
  }

  /**
   * Update a user's password. Used by:
   * - Password reset flow (forgot password → email → new password)
   * - Change password flow (authenticated user changes their own password)
   *
   * Always hash before storing — NEVER store plaintext passwords.
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await argon2.hash(newPassword);

    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    this.logger.log(`Password updated for user: ${userId}`);
  }

  /**
   * Mark a user's email as verified.
   * Called after they click the verification link.
   */
  async markEmailVerified(userId: string): Promise<User> {
    return this.db.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Profile management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Update a user's profile fields (name for now, avatar later).
   * Returns the updated user.
   */
  async updateProfile(
    userId: string,
    data: { name: string },
  ): Promise<User> {
    const user = await this.db.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
    });

    this.logger.log(`Profile updated for user: ${userId}`);
    return user;
  }

  /**
   * Delete a user and all related data.
   *
   * All relations (OAuthAccount, RefreshToken, Subscription, etc.)
   * have `onDelete: Cascade` in the Prisma schema, so a single
   * `user.delete()` removes everything atomically.
   */
  async deleteUser(userId: string): Promise<void> {
    await this.db.user.delete({
      where: { id: userId },
    });

    this.logger.log(`User deleted: ${userId}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Avatar
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Update the user's avatar URL in the database.
   * Pass null to clear the avatar.
   */
  async updateAvatarUrl(
    userId: string,
    avatarUrl: string | null,
  ): Promise<User> {
    const user = await this.db.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    this.logger.log(`Avatar ${avatarUrl ? 'updated' : 'removed'} for user: ${userId}`);
    return user;
  }

  /**
   * Delete a user's avatar from storage.
   *
   * The tricky part: we need to extract the storage "key" from the URL.
   * - Local URLs look like: /uploads/avatars/uuid.jpg → key: "avatars/uuid.jpg"
   * - R2 URLs look like: https://cdn.app.com/avatars/uuid.jpg → key: "avatars/uuid.jpg"
   *
   * We extract the key by finding "avatars/" in the URL and taking everything after.
   * If it's an external URL (e.g. Google OAuth avatar), we skip deletion.
   */
  async deleteAvatar(
    user: User,
    storage: StorageProvider,
  ): Promise<void> {
    if (!user.avatarUrl) return;

    // Extract storage key from the URL
    // For local: "/uploads/avatars/uuid.jpg" → "avatars/uuid.jpg"
    // For R2: "https://cdn.app.com/avatars/uuid.jpg" → "avatars/uuid.jpg"
    const avatarsIndex = user.avatarUrl.indexOf('avatars/');
    if (avatarsIndex === -1) {
      // External URL (e.g. Google avatar) — nothing to delete from our storage
      this.logger.debug(`Skipping avatar delete — external URL: ${user.avatarUrl}`);
      return;
    }

    const key = user.avatarUrl.substring(avatarsIndex);
    await storage.delete(key);
    this.logger.log(`Avatar deleted from storage: ${key}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OAuth
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Find or create a user from an OAuth provider profile.
   *
   * Three scenarios:
   *
   * 1. **Returning OAuth user**: OAuthAccount exists for this provider + providerUserId.
   *    → Return the linked user. (Most common case — returning login.)
   *
   * 2. **Account linking**: A user with the same email exists (registered with
   *    email/password) but no OAuthAccount for this provider.
   *    → Link the OAuth account to the existing user. Auto-verify email
   *    (the OAuth provider already verified it).
   *
   * 3. **New user**: No user with this email exists.
   *    → Create a new user (no password) + OAuthAccount in a transaction.
   *    Email is auto-verified.
   *
   * Returns `{ user, isNewUser }` so the caller can emit the right event.
   */
  async findOrCreateOAuthUser(
    profile: OAuthProfile,
  ): Promise<{ user: User; isNewUser: boolean }> {
    // ── Scenario 1: Returning OAuth user ──
    const existingOAuth = await this.db.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      // Update stored OAuth tokens (they may have been refreshed by the provider)
      await this.db.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessToken: profile.accessToken ?? existingOAuth.accessToken,
          refreshToken: profile.refreshToken ?? existingOAuth.refreshToken,
          expiresAt: profile.expiresAt ?? existingOAuth.expiresAt,
        },
      });

      this.logger.log(
        `Returning OAuth user: ${existingOAuth.user.id} (${profile.provider})`,
      );
      return { user: existingOAuth.user, isNewUser: false };
    }

    // ── Scenario 2: Account linking ──
    const existingUser = await this.findByEmail(profile.email);

    if (existingUser) {
      // Link the new OAuth provider to the existing account
      await this.db.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          expiresAt: profile.expiresAt,
        },
      });

      // Auto-verify email (OAuth provider has verified it) and fill in
      // missing profile data if the user hasn't set them manually.
      const updatedUser = await this.db.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
          avatarUrl: existingUser.avatarUrl ?? profile.avatarUrl ?? null,
          name: existingUser.name ?? profile.name ?? null,
        },
      });

      this.logger.log(
        `OAuth account linked: ${existingUser.id} ← ${profile.provider}`,
      );
      return { user: updatedUser, isNewUser: false };
    }

    // ── Scenario 3: New user ──
    // Use a transaction to ensure user + OAuth account are created atomically.
    const newUser = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: profile.email.toLowerCase().trim(),
          passwordHash: null, // OAuth users don't have passwords
          name: profile.name?.trim() || null,
          avatarUrl: profile.avatarUrl || null,
          emailVerified: true, // OAuth provider verified the email
          emailVerifiedAt: new Date(),
        },
      });

      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          expiresAt: profile.expiresAt,
        },
      });

      return user;
    });

    this.logger.log(
      `New OAuth user created: ${newUser.id} (${profile.provider})`,
    );
    return { user: newUser, isNewUser: true };
  }
}
