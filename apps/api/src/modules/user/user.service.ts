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
}
