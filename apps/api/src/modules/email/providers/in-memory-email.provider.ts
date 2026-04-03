/**
 * # In-Memory Email Provider (Test)
 *
 * Captures sent emails in an array instead of delivering them.
 * Used in tests so you can assert what emails were sent.
 *
 * ## Usage in e2e tests
 *
 * ```typescript
 * import { EMAIL_PROVIDER } from '../modules/email/providers/email-provider.interface';
 * import { InMemoryEmailProvider } from '../modules/email/providers/in-memory-email.provider';
 *
 * const emailProvider = app.get<InMemoryEmailProvider>(EMAIL_PROVIDER);
 *
 * // ... do something that triggers an email ...
 *
 * const emails = emailProvider.getSentEmails();
 * expect(emails).toHaveLength(1);
 * expect(emails[0].to).toBe('user@example.com');
 * expect(emails[0].subject).toContain('Verify');
 * ```
 *
 * ## Why not just mock?
 *
 * You COULD mock the provider with `vi.fn()`, but this is cleaner:
 * - Works across the entire e2e test (real NestJS app, real event bus)
 * - The `getSentEmails()` API is self-documenting
 * - `clearSentEmails()` resets state between tests
 */
import { Injectable } from '@nestjs/common';
import type { EmailProvider, SendEmailOptions } from './email-provider.interface';

@Injectable()
export class InMemoryEmailProvider implements EmailProvider {
  private readonly sentEmails: SendEmailOptions[] = [];

  async send(options: SendEmailOptions): Promise<void> {
    this.sentEmails.push({ ...options }); // Store a copy (defensive)
  }

  /** Get all emails that have been "sent" (captured). */
  getSentEmails(): ReadonlyArray<SendEmailOptions> {
    return this.sentEmails;
  }

  /** Clear the captured emails. Call this in `beforeEach()`. */
  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}
