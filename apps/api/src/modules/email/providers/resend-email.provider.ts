/**
 * # Resend Email Provider (Production)
 *
 * Delivers real emails via the Resend API (https://resend.com).
 *
 * ## Why Resend over SendGrid, SES, etc.?
 *
 * - Modern developer-focused API (simple SDK, great docs)
 * - Built-in analytics (opens, clicks, bounces)
 * - Free tier: 3,000 emails/month (enough for early-stage SaaS)
 * - React Email integration (for future template upgrades)
 *
 * ## Error handling
 *
 * Email delivery is BEST-EFFORT. If Resend returns an error, we LOG it
 * but do NOT throw. Auth flows (register, password reset) must NEVER
 * fail because email delivery failed. The user still gets their token —
 * they just won't get the email notification.
 *
 * In a production setup with queues (Phase 8), failed emails would be
 * retried via a dead letter queue. For now, we just log and move on.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailProvider, SendEmailOptions } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('EmailProvider:Resend');
  private readonly client: Resend;
  private readonly defaultFrom: string;

  constructor(apiKey: string, fromAddress: string) {
    this.client = new Resend(apiKey);
    this.defaultFrom = fromAddress;
  }

  async send(options: SendEmailOptions): Promise<void> {
    const from = options.from ?? this.defaultFrom;

    try {
      const { error } = await this.client.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        // Resend returns structured errors (not exceptions).
        // Log the error but don't throw — email is best-effort.
        this.logger.error(
          `Failed to send email to ${options.to}: ${error.message}`,
          { name: error.name, to: options.to, subject: options.subject },
        );
        return;
      }

      this.logger.debug(`Email sent to ${options.to}: "${options.subject}"`);
    } catch (error) {
      // Network error, API down, etc.
      this.logger.error(
        `Email delivery error to ${options.to}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
