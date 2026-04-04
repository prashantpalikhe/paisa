/**
 * # Auth Module
 *
 * Registers all authentication providers, strategies, guards, and controllers.
 *
 * ## Module dependency graph
 *
 * ```
 * AppModule
 *   └── AuthModule
 *         ├── imports: UserModule (user CRUD)
 *         ├── imports: JwtModule (token signing)
 *         ├── imports: PassportModule (strategy framework)
 *         │
 *         ├── providers:
 *         │     ├── AuthService (orchestrates flows)
 *         │     ├── TokenService (JWT + refresh tokens)
 *         │     ├── LocalStrategy (email/password validation)
 *         │     ├── JwtStrategy (JWT token validation)
 *         │     ├── GoogleStrategy (Google OAuth — feature-flagged)
 *         │     ├── GoogleOAuthGuard (checks feature flag before OAuth)
 *         │     └── RolesGuard (RBAC)
 *         │
 *         ├── controllers:
 *         │     └── AuthController (HTTP endpoints)
 *         │
 *         └── exports:
 *               ├── AuthService
 *               └── TokenService
 * ```
 *
 * ## Global Guard Registration
 *
 * JwtAuthGuard is registered as a GLOBAL guard via APP_GUARD.
 * This means EVERY route requires a valid JWT by default.
 * Use @Public() to opt-out for public routes (login, register, etc.).
 *
 * This is safer than the alternative (no global guard) because:
 * - Forgetting to add a guard = route is PROTECTED (secure by default)
 * - Vs. forgetting to add a guard = route is PUBLIC (security hole)
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigService } from '../../core/config/config.service';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';

@Module({
  imports: [
    // UserModule provides UserService for user lookups and creation
    UserModule,

    // PassportModule enables Passport strategies (local, jwt)
    PassportModule,

    // JwtModule configures JWT signing/verification.
    // Uses registerAsync to inject AppConfigService for the secret and expiry.
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.env.JWT_SECRET,
        signOptions: {
          // Cast needed: @nestjs/jwt expects StringValue (branded type),
          // but our env config returns a plain string like "15m".
          expiresIn: config.env.JWT_ACCESS_EXPIRY as any,
        },
      }),
    }),
  ],

  controllers: [AuthController, PasskeyController],

  providers: [
    // ─── Services ───
    AuthService,
    TokenService,
    PasskeyService,

    // ─── Passport Strategies ───
    // These are auto-detected by Passport when registered as providers.
    // GoogleStrategy is always registered but GoogleOAuthGuard checks the
    // feature flag — if disabled, the endpoints return 404 before the
    // strategy is ever invoked.
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,

    // ─── Feature-flagged Guards ───
    GoogleOAuthGuard,

    // ─── Global Guards ───
    // APP_GUARD makes these apply to EVERY route automatically.
    // Order matters: JWT runs first (authn), then Roles (authz).
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],

  exports: [AuthService, TokenService],
})
export class AuthModule {}
