/**
 * # Console Email Provider (Development)
 *
 * Prints emails to the terminal instead of sending them.
 * Used in development so you can see what emails would be sent
 * without configuring a real email service.
 *
 * Example output:
 *
 * ```
 * ┌──────────────────────────────────────────────────────┐
 * │ EMAIL                                                │
 * ├──────────────────────────────────────────────────────┤
 * │ To:      user@example.com                            │
 * │ Subject: Verify your email                           │
 * │ From:    noreply@paisa.dev                           │
 * ├──────────────────────────────────────────────────────┤
 * │ Click here to verify: http://localhost:3000/verify.. │
 * └──────────────────────────────────────────────────────┘
 * ```
 */
import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, SendEmailOptions } from './email-provider.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('EmailProvider:Console');

  async send(options: SendEmailOptions): Promise<void> {
    // Use the plain text version for the preview (much cleaner than HTML in a terminal)
    const preview = options.text.length > 200
      ? options.text.substring(0, 200) + '...'
      : options.text;

    this.logger.log(
      [
        '',
        '┌──────────────────────────────────────────────────────┐',
        '│ EMAIL (dev — not actually sent)                      │',
        '├──────────────────────────────────────────────────────┤',
        `│ To:      ${options.to}`,
        `│ Subject: ${options.subject}`,
        options.from ? `│ From:    ${options.from}` : null,
        '├──────────────────────────────────────────────────────┤',
        ...preview.split('\n').map((line) => `│ ${line}`),
        '└──────────────────────────────────────────────────────┘',
        '',
      ]
        .filter((line) => line !== null)
        .join('\n'),
    );
  }
}
