/**
 * # Local Strategy (Passport)
 *
 * Validates email + password during login.
 *
 * ## How Passport strategies work
 *
 * ```
 * POST /auth/login { email, password }
 *       │
 *       ▼
 * LocalAuthGuard (triggers Passport)
 *       │
 *       ▼
 * LocalStrategy.validate(email, password)
 *       │
 *       ├── User not found? → UnauthorizedException
 *       ├── Wrong password? → UnauthorizedException
 *       ├── User banned?    → UnauthorizedException
 *       │
 *       ▼
 * Returns User → attached to request.user
 *       │
 *       ▼
 * Controller method runs with request.user populated
 * ```
 *
 * Passport calls `validate()` automatically when the guard triggers.
 * Whatever `validate()` returns becomes `request.user`.
 *
 * ## Why "Invalid email or password" (not "User not found" or "Wrong password")?
 *
 * Security best practice: Don't reveal whether the email exists.
 * If we said "User not found", attackers could enumerate valid emails.
 * A generic message prevents this information leakage.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UserService } from '../../user/user.service';
import type { User } from '@paisa/db';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    // Tell passport-local to use 'email' field instead of default 'username'
    super({ usernameField: 'email' });
  }

  /**
   * Called by Passport when LocalAuthGuard is triggered.
   * Must return the user object or throw an exception.
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if the account is banned
    if (user.banned) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    // Verify the password against the stored Argon2 hash
    const isPasswordValid = await this.userService.verifyPassword(
      user,
      password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // This becomes request.user in the controller
    return user;
  }
}
