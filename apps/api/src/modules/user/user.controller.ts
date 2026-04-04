/**
 * # User Controller
 *
 * Profile and account management endpoints.
 * All routes require authentication (global JWT guard).
 *
 * ## Endpoints
 *
 * | Method | Path               | Purpose                          |
 * |--------|--------------------|----------------------------------|
 * | PATCH  | /users/me          | Update profile (name)            |
 * | POST   | /users/me/avatar   | Upload avatar image              |
 * | DELETE | /users/me/avatar   | Remove avatar image              |
 * | DELETE | /users/me          | Delete account (requires password)|
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
 *
 * ## Avatar upload
 *
 * Uses multipart/form-data (not JSON). The file is validated for:
 * - Size: max 2 MB
 * - Type: image/jpeg, image/png, image/webp, image/gif only
 *
 * Storage is handled by the StorageModule (local in dev, R2 in production).
 * StorageModule is always loaded — email and storage are core functionality.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
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
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/providers/storage-provider.interface';

/** Cookie name — must match AuthController */
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Max avatar file size: 2 MB */
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

/** Allowed MIME types for avatars */
const ALLOWED_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly config: AppConfigService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Avatar
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Upload a new avatar image.
   *
   * How multipart file uploads work in NestJS:
   *
   * 1. `@UseInterceptors(FileInterceptor('file'))` tells NestJS to parse
   *    the incoming multipart/form-data request and extract the file
   *    from the field named "file". Under the hood, this uses Multer.
   *
   * 2. `@UploadedFile()` injects the parsed file object, which contains:
   *    - `buffer`: The raw file bytes (stored in memory, not on disk)
   *    - `originalname`: The filename the user's browser sent
   *    - `mimetype`: The MIME type (e.g. "image/jpeg")
   *    - `size`: File size in bytes
   *
   * 3. We validate the file manually (size + type), then pass it to
   *    the storage provider which handles the actual upload.
   */
  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload avatar' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadAvatar(
    @CurrentUser() currentUser: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Guard: file must be present
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024} MB`,
      );
    }

    // Validate file type
    if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${ALLOWED_AVATAR_TYPES.join(', ')}`,
      );
    }

    // Delete the old avatar if one exists (don't leave orphaned files)
    const existingUser = await this.userService.findById(currentUser.id);
    if (existingUser?.avatarUrl) {
      await this.userService.deleteAvatar(existingUser, this.storage);
    }

    // Upload the new avatar
    const result = await this.storage.upload({
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      folder: 'avatars',
    });

    // Save the URL to the database
    const user = await this.userService.updateAvatarUrl(
      currentUser.id,
      result.url,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      has2FA: false,
      hasPasskey: false,
    };
  }

  /**
   * Remove the current user's avatar.
   * Deletes the file from storage and clears the database URL.
   */
  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove avatar' })
  @ApiResponse({ status: 200, description: 'Avatar removed' })
  async removeAvatar(@CurrentUser() currentUser: AuthUser) {
    const existingUser = await this.userService.findById(currentUser.id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Delete from storage if there's an avatar
    if (existingUser.avatarUrl) {
      await this.userService.deleteAvatar(existingUser, this.storage);
    }

    // Clear the URL in the database
    const user = await this.userService.updateAvatarUrl(currentUser.id, null);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      has2FA: false,
      hasPasskey: false,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Account deletion
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
