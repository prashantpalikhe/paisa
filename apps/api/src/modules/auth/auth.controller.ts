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
 *   GET  /auth/google          → Redirect to Google consent screen
 *   GET  /auth/google/callback → Google redirects here → issue tokens → redirect to frontend
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
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags, ApiBody, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response, Request } from 'express';
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  setPasswordSchema,
} from '@paisa/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AppConfigService } from '../../core/config/config.service';
import { AuthService } from './auth.service';
import { PasskeyService } from './passkey.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import type { GoogleOAuthResult } from './strategies/google.strategy';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  SetPasswordDto,
  ChangePasswordDto,
  AuthTokenResponseDto,
  AuthUserDto,
  MessageResponseDto,
  RefreshResponseDto,
} from './dto/auth.dto';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import {
  setRefreshCookie,
  toAuthUser,
} from './auth.helpers';
import type { AuthUser } from '@paisa/shared';
import type { User } from '@paisa/db';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly passkeyService: PasskeyService,
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

    setRefreshCookie(res, result.tokenPair.refreshToken, this.config);

    return {
      accessToken: result.tokenPair.accessToken,
      expiresIn: result.tokenPair.expiresIn,
      user: toAuthUser(result.user, false), // Newly registered — no passkeys
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

    setRefreshCookie(res, tokenPair.refreshToken, this.config);

    return {
      accessToken: tokenPair.accessToken,
      expiresIn: tokenPair.expiresIn,
      user: toAuthUser(req.user, await this.passkeyService.hasPasskey(req.user.id)),
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

    setRefreshCookie(res, tokenPair.refreshToken, this.config);

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
  // GOOGLE OAUTH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Initiate Google OAuth flow.
   *
   * Redirects the browser to Google's consent screen.
   * This method body never executes — Passport intercepts and redirects.
   *
   * The GoogleOAuthGuard checks the feature flag first:
   * - If FEATURE_AUTH_GOOGLE_ENABLED=false → 404 (endpoint doesn't exist)
   * - If enabled → Passport redirects to Google
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google consent screen' })
  @ApiResponse({ status: 404, description: 'Google OAuth is not enabled' })
  googleAuth() {
    // Passport handles the redirect — this body never runs
  }

  /**
   * Google OAuth callback.
   *
   * Google redirects here after the user grants (or denies) consent.
   * Passport exchanges the authorization code for tokens and calls
   * GoogleStrategy.validate(), which:
   * 1. Finds or creates the user (+ links accounts if needed)
   * 2. Generates JWT access token + refresh token
   * 3. Attaches the result to request.user
   *
   * We then set the refresh token as an httpOnly cookie and redirect
   * to the frontend with the access token in the URL.
   *
   * Why redirect instead of JSON?
   * This is a browser redirect from Google — we can't return JSON.
   * The frontend reads the token from the URL, stores it in memory,
   * and clears the URL parameter immediately.
   *
   * Why @Res() without passthrough?
   * We call res.redirect() directly, so NestJS interceptors (like
   * ResponseTransformInterceptor) should NOT process the return value.
   * Using @Res() (not @Res({ passthrough: true })) tells NestJS we're
   * handling the response ourselves.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiExcludeEndpoint() // Don't show in Swagger — it's a browser redirect, not an API call
  async googleCallback(
    @Req() req: Request & { user: GoogleOAuthResult },
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.env.FRONTEND_URL;

    try {
      const { user, tokenPair } = req.user;

      // Set refresh token as httpOnly cookie (same as login/register)
      setRefreshCookie(res, tokenPair.refreshToken, this.config);

      // Redirect to frontend with access token in URL.
      // The frontend reads the token, stores it in memory, and clears the URL.
      const redirectUrl = new URL('/auth/callback', frontendUrl);
      redirectUrl.searchParams.set('token', tokenPair.accessToken);
      redirectUrl.searchParams.set('expiresIn', String(tokenPair.expiresIn));

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      // If anything goes wrong, redirect to frontend with error
      this.logger.error('Google OAuth callback error:', error);

      const errorUrl = new URL('/auth/callback', frontendUrl);
      errorUrl.searchParams.set('error', 'oauth_failed');

      return res.redirect(errorUrl.toString());
    }
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
    // Enrich with hasPasskey (not included in JWT strategy to avoid per-request cost)
    const hasPasskey = await this.passkeyService.hasPasskey(user.id);
    return { ...user, hasPasskey };
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
   * Set a password for OAuth-only accounts (no existing password).
   *
   * Only works when the user has no password (passwordHash is null).
   * This lets Google OAuth users add email/password as a login method.
   */
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set password for OAuth-only account' })
  @ApiBody({ type: SetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password set', type: MessageResponseDto })
  @ApiResponse({ status: 409, description: 'User already has a password' })
  async setPassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(setPasswordSchema))
    body: { password: string },
  ) {
    await this.authService.setPassword(user.id, body.password);
    return { message: 'Password set successfully.' };
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

}
