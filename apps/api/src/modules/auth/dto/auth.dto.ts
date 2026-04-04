/**
 * # Auth DTOs (Data Transfer Objects)
 *
 * These classes serve ONE purpose: telling Swagger/Scalar what the
 * request body looks like. They are NOT used for validation — that's
 * handled by Zod schemas from @paisa/shared via ZodValidationPipe.
 *
 * ## Why not use class-validator?
 *
 * We use Zod for validation (shared between frontend and backend).
 * But @nestjs/swagger can't read Zod schemas — it needs classes with
 * @ApiProperty() decorators. So these DTOs are Swagger-only metadata.
 *
 * ## Keeping in sync
 *
 * If you change a Zod schema in @paisa/shared, update the matching DTO
 * here too. The DTO is documentation — the Zod schema is the source of truth.
 *
 * TODO: Consider generating DTOs from Zod schemas automatically using
 * `nestjs-zod` or `@anatine/zod-nestjs` to eliminate drift risk.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST DTOs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address (must be valid)',
  })
  email!: string;

  @ApiProperty({
    example: 'MyPassword123',
    description: 'Password (min 8 chars, must contain lowercase, uppercase, and number)',
    minLength: 8,
    maxLength: 128,
  })
  password!: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Display name (optional, max 100 chars)',
    maxLength: 100,
  })
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'MyPassword123' })
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the account to reset',
  })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Reset token from the email link',
  })
  token!: string;

  @ApiProperty({
    example: 'NewPassword123',
    description: 'New password (same requirements as registration)',
    minLength: 8,
  })
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Verification token from the email link',
  })
  token!: string;
}

export class SetPasswordDto {
  @ApiProperty({
    example: 'NewPassword123',
    description: 'Password to set (same requirements as registration)',
    minLength: 8,
  })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123',
    description: 'Current password (must match)',
  })
  currentPassword!: string;

  @ApiProperty({
    example: 'NewPassword456',
    description: 'New password (same requirements as registration)',
    minLength: 8,
  })
  newPassword!: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESPONSE DTOs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class AuthUserDto {
  @ApiProperty({ example: 'clxyz123...' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  name?: string | null;

  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] })
  role!: string;

  @ApiProperty({ example: false })
  emailVerified!: boolean;

  @ApiPropertyOptional({ example: null })
  avatarUrl?: string | null;

  @ApiProperty({ example: true })
  hasPassword!: boolean;

  @ApiProperty({ example: false })
  has2FA!: boolean;

  @ApiProperty({ example: false })
  hasPasskey!: boolean;
}

export class AuthTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'Token expiry in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;
}

export class RefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}
