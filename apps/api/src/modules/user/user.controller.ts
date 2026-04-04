/**
 * # User Controller
 *
 * Profile and account management endpoints.
 * All routes require authentication (global JWT guard).
 *
 * ## Endpoints
 *
 * | Method | Path          | Purpose                          |
 * |--------|---------------|----------------------------------|
 * | GET    | /users/me     | Get current user profile         |
 * | PATCH  | /users/me     | Update profile (name)            |
 * | DELETE | /users/me     | Delete account (requires password)|
 *
 * ## Why not PUT?
 *
 * PATCH for partial updates — we only change the fields that are sent.
 * PUT implies replacing the entire resource, which doesn't fit here.
 *
 * ## Password change
 *
 * Lives at POST /auth/change-password (AuthController), not here.
 * This avoids circular module dependencies — AuthService handles
 * all password-related operations.
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  updateProfileSchema,
  deleteAccountSchema,
  type AuthUser,
} from '@paisa/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../core/config/config.service';
import { UserService } from './user.service';

/** Cookie name — must match AuthController */
const REFRESH_TOKEN_COOKIE = 'refresh_token';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Update the current user's profile.
   *
   * Only the `name` field is editable for now. Email changes
   * would require re-verification and are a separate flow.
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async updateProfile(
    @CurrentUser() currentUser: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema))
    body: { name: string },
  ) {
    const user = await this.userService.updateProfile(currentUser.id, body);

    // Return the same shape as GET /auth/me for consistency
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      has2FA: false, // TODO: populate when 2FA is implemented
      hasPasskey: false, // TODO: populate when passkeys are implemented
    };
  }

  /**
   * Delete the current user's account.
   *
   * Requires the user's password as confirmation — this is a destructive
   * action that cannot be undone. OAuth-only users (no password) cannot
   * delete their account through this endpoint yet.
   *
   * The endpoint also clears the refresh token cookie, since the user's
   * session should end immediately after deletion.
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete account (requires password)' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Wrong password' })
  async deleteAccount(
    @CurrentUser() currentUser: AuthUser,
    @Body(new ZodValidationPipe(deleteAccountSchema))
    body: { password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Load the full user (we need the passwordHash for verification)
    const user = await this.userService.findById(currentUser.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Verify the password
    const passwordValid = await this.userService.verifyPassword(
      user,
      body.password,
    );
    if (!passwordValid) {
      throw new ForbiddenException('Incorrect password');
    }

    // 3. Delete the user (cascades to all related data)
    await this.userService.deleteUser(currentUser.id);

    // 4. Clear the refresh token cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: !this.config.isDevelopment,
      sameSite: this.config.cookieSameSite,
      path: '/',
    });

    return { message: 'Account deleted successfully.' };
  }
}
