/**
 * # Auth Controller
 *
 * HTTP endpoints for all authentication flows.
 *
 * ## Endpoints
 *
 * ```
 * PUBLIC (no auth needed):
 *   POST /auth/register        → Create account, get tokens
 *   POST /auth/login           → Email/password login, get tokens
 *   POST /auth/refresh         → Exchange refresh cookie for new tokens
 *   POST /auth/forgot-password → Request password reset email
 *   POST /auth/reset-password  → Reset password with token
 *   POST /auth/verify-email    → Verify email with token
 *
 * PROTECTED (auth required):
 *   GET    /auth/me              → Get current user profile
 *   POST   /auth/logout          → Revoke session, clear cookie
 *   POST   /auth/change-password → Change password (requires current)
 *   POST   /auth/resend-verification → Resend email verification
 * ```
 *
 * ## Cookie Strategy
 *
 * The refresh token is stored in an httpOnly cookie. This means:
 * - JavaScript CANNOT read it (XSS protection)
 * - Browser sends it automatically on same-site requests
 * - We set it with configurable SameSite based on environment
 *
 * The access token is returned in the response body.
 * The frontend stores it in memory (not localStorage — XSS risk).
 *
 * ## Validation
 *
 * Request bodies are validated using Zod schemas from @paisa/shared.
 * The same schemas are used on the frontend for form validation.
 * This ensures the API and UI agree on what's valid.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
} from '@paisa/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../core/config/config.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  AuthTokenResponseDto,
  AuthUserDto,
  MessageResponseDto,
  RefreshResponseDto,
} from './dto/auth.dto';
import type { AuthUser } from '@paisa/shared';
import type { User } from '@paisa/db';

/** Name of the refresh token cookie */
const REFRESH_TOKEN_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC ENDPOINTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Register a new account.
   *
   * - Validates request body with registerSchema (email, password, name?)
   * - Creates the user
   * - Returns access token in body, sets refresh token as httpOnly cookie
   * - Emits user.registered event (email sent in Phase 4)
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Account created', type: AuthTokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed (invalid email, weak password)' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: { email: string; password: string; name?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      body.email,
      body.password,
      body.name,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    );

    this.setRefreshCookie(res, result.tokenPair.refreshToken);

    return {
      accessToken: result.tokenPair.accessToken,
      expiresIn: result.tokenPair.expiresIn,
      user: this.toAuthUser(result.user),
    };
  }

  /**
   * Login with email and password.
   *
   * Uses Passport's LocalStrategy to validate credentials.
   * The @UseGuards(AuthGuard('local')) decorator triggers:
   * 1. Passport extracts email/password from request body
   * 2. LocalStrategy.validate() checks credentials
   * 3. If valid, user is attached to request.user
   * 4. This method runs with the validated user
   *
   * Note: We DON'T use ZodValidationPipe here because
   * Passport's LocalStrategy handles the validation.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthTokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(
    @Req() req: Request & { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenPair = await this.authService.login(req.user, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    this.setRefreshCookie(res, tokenPair.refreshToken);

    return {
      accessToken: tokenPair.accessToken,
      expiresIn: tokenPair.expiresIn,
      user: this.toAuthUser(req.user),
    };
  }

  /**
   * Refresh the access token.
   *
   * Reads the refresh token from the httpOnly cookie (set during login/register).
   * Returns a new access token and rotates the refresh token (new cookie).
   *
   * This is called by the frontend when the access token expires (~every 15 min).
   * The browser sends the cookie automatically — no JavaScript involved.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh cookie' })
  @ApiResponse({ status: 200, description: 'New access token', type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!rawRefreshToken) {
      // No cookie → user needs to login again
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      throw new UnauthorizedException('Not authenticated');
    }

    const tokenPair = await this.authService.refresh(rawRefreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    this.setRefreshCookie(res, tokenPair.refreshToken);

    return {
      accessToken: tokenPair.accessToken,
      expiresIn: tokenPair.expiresIn,
    };
  }

  /**
   * Request a password reset email.
   *
   * ALWAYS returns 200 (even if email doesn't exist) to prevent
   * email enumeration attacks.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Always returns 200 (prevents email enumeration)', type: MessageResponseDto })
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string }) {
    await this.authService.forgotPassword(body.email);

    // Always return the same response (don't reveal if email exists)
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  /**
   * Reset password using the token from the reset email.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string }) {
    await this.authService.resetPassword(body.token, body.password);
    return { message: 'Password has been reset. Please log in with your new password.' };
  }

  /**
   * Verify email address using the token from the verification email.
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from verification email' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) body: { token: string }) {
    await this.authService.verifyEmail(body.token);
    return { message: 'Email verified successfully.' };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROTECTED ENDPOINTS (auth required)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get the current authenticated user's profile.
   *
   * Called by the frontend on page load to check auth state.
   * Also used to get the latest user data after profile changes.
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user', type: AuthUserDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /**
   * Logout — revoke the refresh token and clear the cookie.
   *
   * The access token can't be revoked (it's stateless).
   * It will expire naturally in ≤15 minutes.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke session' })
  @ApiResponse({ status: 200, description: 'Logged out', type: MessageResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    await this.authService.logout(rawRefreshToken);

    // Clear the cookie regardless of whether revocation succeeded
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: !this.config.isDevelopment,
      sameSite: this.config.cookieSameSite,
      path: '/',
    });

    return { message: 'Logged out successfully.' };
  }

  /**
   * Change password (requires current password).
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password)' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Wrong current password or not authenticated' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: { currentPassword: string; newPassword: string },
  ) {
    await this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { message: 'Password changed successfully.' };
  }

  /**
   * Resend email verification.
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent', type: MessageResponseDto })
  async resendVerification(@CurrentUser() user: AuthUser) {
    await this.authService.resendVerificationEmail(user.id);
    return { message: 'Verification email sent.' };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRIVATE HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  private setRefreshCookie(res: Response, refreshToken: string): void {
    const maxAgeMs = this.parseExpiryToMs(this.config.env.JWT_REFRESH_EXPIRY);

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: !this.config.isDevelopment,
      sameSite: this.config.cookieSameSite,
      path: '/',
      maxAge: maxAgeMs,
    });
  }

  /**
   * Convert a Prisma User to the AuthUser shape shared with the frontend.
   */
  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'USER' | 'ADMIN',
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      has2FA: false, // Phase 3
      hasPasskey: false, // Phase 3
    };
  }

  /**
   * Parse "7d", "15m", etc. to milliseconds.
   */
  private parseExpiryToMs(expiry: string): number {
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
}
