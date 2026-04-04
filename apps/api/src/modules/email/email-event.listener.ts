/**
 * # Email Event Listener
 *
 * Listens for domain events and sends the appropriate email.
 *
 * ## Architecture
 *
 * ```
 * ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
 * │   AuthService     │──emit──▶│   EventBus        │──fire──▶│ EmailEventListener│
 * │                   │         │                   │         │                   │
 * │ • register()      │         │ 'user.registered' │         │ @OnEvent(...)     │
 * │ • forgotPassword()│         │ 'user.password_   │         │  → template()     │
 * │ • etc.            │         │   reset_requested'│         │  → provider.send()│
 * └──────────────────┘         └──────────────────┘         └──────────────────┘
 * ```
 *
 * ## Error handling
 *
 * EVERY handler wraps in try/catch. Email failures must NEVER propagate
 * back to the auth flow. If Resend is down, the user still registers,
 * still gets their tokens — they just don't get the email.
 *
 * ## Why @OnEvent() instead of manually subscribing?
 *
 * NestJS's @OnEvent() is declarative — you see the event name right on
 * the method. It also handles lifecycle (auto-cleanup when module is destroyed).
 * Manual subscription would require explicit unsubscribe in onModuleDestroy().
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS } from '@paisa/shared';
import type {
  UserRegisteredPayload,
  UserVerificationResentPayload,
  UserVerifiedEmailPayload,
  UserPasswordResetRequestedPayload,
  UserPasswordChangedPayload,
  UserOAuthLinkedPayload,
} from '@paisa/shared';
import { AppConfigService } from '../../core/config/config.service';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';
import type { EmailProvider } from './providers/email-provider.interface';
import {
  welcomeEmail,
  verifyEmail,
  emailVerifiedEmail,
  passwordResetEmail,
  passwordChangedEmail,
  oauthLinkedEmail,
} from './templates';

@Injectable()
export class EmailEventListener {
  private readonly logger = new Logger(EmailEventListener.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    config: AppConfigService,
  ) {
    this.frontendUrl = config.env.FRONTEND_URL;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * New user registered with email/password.
   * Send a welcome email with the verification link.
   *
   * Skip for OAuth registrations — they have no verification token
   * because the OAuth provider already verified their email.
   */
  @OnEvent(DOMAIN_EVENTS.USER_REGISTERED)
  async onUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    // OAuth registrations don't need a verification email
    if (payload.oauthProvider) {
      this.logger.debug(
        `Skipping welcome email for OAuth user ${payload.userId} (${payload.oauthProvider})`,
      );
      return;
    }

    if (!payload.verificationToken) {
      this.logger.warn(
        `No verification token in USER_REGISTERED event for user ${payload.userId}`,
      );
      return;
    }

    try {
      const verifyUrl = `${this.frontendUrl}/verify-email?token=${payload.verificationToken}`;
      const email = welcomeEmail(payload.name, verifyUrl);

      await this.emailProvider.send({
        to: payload.email,
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${payload.email}:`,
        (error as Error).stack,
      );
    }
  }

  /**
   * User requested verification email resend.
   * Send a verification-only email (no "welcome" messaging).
   */
  @OnEvent(DOMAIN_EVENTS.USER_VERIFICATION_RESENT)
  async onVerificationResent(payload: UserVerificationResentPayload): Promise<void> {
    try {
      const verifyUrl = `${this.frontendUrl}/verify-email?token=${payload.verificationToken}`;
      const email = verifyEmail(payload.name, verifyUrl);

      await this.emailProvider.send({
        to: payload.email,
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${payload.email}:`,
        (error as Error).stack,
      );
    }
  }

  /**
   * User verified their email.
   * Send a confirmation email.
   */
  @OnEvent(DOMAIN_EVENTS.USER_VERIFIED_EMAIL)
  async onEmailVerified(payload: UserVerifiedEmailPayload): Promise<void> {
    try {
      const email = emailVerifiedEmail(payload.email);

      await this.emailProvider.send({
        to: payload.email,
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email-verified confirmation to ${payload.email}:`,
        (error as Error).stack,
      );
    }
  }

  /**
   * User requested a password reset.
   * Send the reset link.
   */
  @OnEvent(DOMAIN_EVENTS.USER_PASSWORD_RESET_REQUESTED)
  async onPasswordResetRequested(payload: UserPasswordResetRequestedPayload): Promise<void> {
    try {
      const resetUrl = `${this.frontendUrl}/reset-password?token=${payload.resetToken}`;
      const email = passwordResetEmail(payload.name, resetUrl);

      await this.emailProvider.send({
        to: payload.email,
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${payload.email}:`,
        (error as Error).stack,
      );
    }
  }

  /**
   * User changed their password (either via reset or change flow).
   * Send a security notification.
   */
  @OnEvent(DOMAIN_EVENTS.USER_PASSWORD_CHANGED)
  async onPasswordChanged(payload: UserPasswordChangedPayload): Promise<void> {
    if (!payload.email) {
      this.logger.warn(
        `No email in USER_PASSWORD_CHANGED event for user ${payload.userId}`,
      );
      return;
    }

    try {
      const email = passwordChangedEmail(payload.name);

      await this.emailProvider.send({
        to: payload.email,
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password-changed email to ${payload.email}:`,
        (error as Error).stack,
      );
    }
  }

  /**
   * OAuth provider was linked to an existing account.
   * Send a security notification.
   */
  @OnEvent(DOMAIN_EVENTS.USER_OAUTH_LINKED)
  async onOAuthLinked(payload: UserOAuthLinkedPayload): Promise<void> {
    try {
      const email = oauthLinkedEmail(payload.name, payload.provider);

      await this.emailProvider.send({
        to: payload.email,
        ...email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send OAuth-linked email to ${payload.email}:`,
        (error as Error).stack,
      );
    }
  }
}
