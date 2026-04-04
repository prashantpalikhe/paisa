/**
 * # Passkey Controller
 *
 * HTTP endpoints for WebAuthn passkey registration, authentication, and management.
 *
 * ## Endpoints
 *
 * ```
 * PUBLIC (no auth needed):
 *   POST /auth/passkey/login/options  → Get authentication challenge
 *   POST /auth/passkey/login/verify   → Verify passkey signature, get tokens
 *
 * PROTECTED (auth required):
 *   POST   /auth/passkey/register/options → Get registration challenge
 *   POST   /auth/passkey/register/verify  → Verify and store new passkey
 *   GET    /auth/passkey                  → List user's passkeys
 *   PATCH  /auth/passkey/:id              → Rename a passkey
 *   DELETE /auth/passkey/:id              → Delete a passkey
 * ```
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import {
  passkeyRegistrationSchema,
  passkeyAuthenticationSchema,
  passkeyRenameSchema,
} from '@paisa/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from './decorators/current-user.decorator';
import { PasskeyService } from './passkey.service';
import { AuthService } from './auth.service';
import { AppConfigService } from '../../core/config/config.service';
import type { AuthUser } from '@paisa/shared';

/** Name of the refresh token cookie (same as auth.controller.ts) */
const REFRESH_TOKEN_COOKIE = 'refresh_token';

@ApiTags('Passkey')
@Controller('auth/passkey')
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATION (authenticated — adding a passkey to your account)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Step 1: Get registration options.
   *
   * Returns a challenge + config that the browser passes to
   * `navigator.credentials.create()` via @simplewebauthn/browser.
   */
  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get passkey registration options' })
  @ApiResponse({ status: 200, description: 'Registration options for WebAuthn' })
  async getRegistrationOptions(@CurrentUser() user: AuthUser) {
    return this.passkeyService.generateRegistrationOptions(user.id, user.email);
  }

  /**
   * Step 2: Verify registration response.
   *
   * The browser created a new credential — verify it and store the public key.
   */
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and store a new passkey' })
  @ApiResponse({ status: 200, description: 'Passkey registered successfully' })
  @ApiResponse({ status: 400, description: 'Verification failed' })
  async verifyRegistration(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(passkeyRegistrationSchema))
    body: { response: any; deviceName?: string },
  ) {
    return this.passkeyService.verifyRegistration(
      user.id,
      body.response,
      body.deviceName,
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AUTHENTICATION (public — logging in with a passkey)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Step 1: Get authentication options.
   *
   * Returns a challenge that the browser passes to
   * `navigator.credentials.get()` via @simplewebauthn/browser.
   *
   * No user email needed — discoverable credentials (passkeys) work
   * without knowing who the user is upfront.
   */
  @Public()
  @Post('login/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get passkey authentication options' })
  @ApiResponse({ status: 200, description: 'Authentication options for WebAuthn' })
  async getAuthenticationOptions() {
    return this.passkeyService.generateAuthenticationOptions();
  }

  /**
   * Step 2: Verify authentication response.
   *
   * The authenticator signed the challenge — verify it and issue tokens.
   * Returns access token + sets refresh cookie (same as email/password login).
   */
  @Public()
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify passkey and login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Passkey not recognized or verification failed' })
  async verifyAuthentication(
    @Body(new ZodValidationPipe(passkeyAuthenticationSchema))
    body: { response: any; challenge: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Verify the passkey signature and get the user
    const user = await this.passkeyService.verifyAuthentication(
      body.response,
      body.challenge,
    );

    // Generate tokens (same flow as email/password login)
    const tokenPair = await this.authService.login(user, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Set refresh cookie
    this.setRefreshCookie(res, tokenPair.refreshToken);

    return {
      accessToken: tokenPair.accessToken,
      expiresIn: tokenPair.expiresIn,
      user: this.toAuthUser(user),
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MANAGEMENT (authenticated — list, rename, delete)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** List all passkeys for the current user */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your passkeys' })
  async listPasskeys(@CurrentUser() user: AuthUser) {
    return this.passkeyService.listPasskeys(user.id);
  }

  /** Rename a passkey */
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rename a passkey' })
  @ApiResponse({ status: 200, description: 'Passkey renamed' })
  @ApiResponse({ status: 404, description: 'Passkey not found' })
  async renamePasskey(
    @CurrentUser() user: AuthUser,
    @Param('id') passkeyId: string,
    @Body(new ZodValidationPipe(passkeyRenameSchema))
    body: { deviceName: string },
  ) {
    return this.passkeyService.renamePasskey(user.id, passkeyId, body.deviceName);
  }

  /** Delete a passkey */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a passkey' })
  @ApiResponse({ status: 200, description: 'Passkey deleted' })
  @ApiResponse({ status: 404, description: 'Passkey not found' })
  async deletePasskey(
    @CurrentUser() user: AuthUser,
    @Param('id') passkeyId: string,
  ) {
    await this.passkeyService.deletePasskey(user.id, passkeyId);
    return { message: 'Passkey deleted successfully.' };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRIVATE HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  private toAuthUser(user: any): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'USER' | 'ADMIN',
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      has2FA: false,
      hasPasskey: true, // They just logged in with one
    };
  }

  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = {
      s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000,
    };
    return value * multipliers[match[2]];
  }
}
