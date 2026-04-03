/**
 * # Email Provider Interface
 *
 * Defines the contract that ALL email providers must implement.
 * This is the Strategy Pattern — swap implementations without
 * changing any code that sends emails.
 *
 * ## Provider implementations
 *
 * | Provider   | Environment | What it does                        |
 * |------------|-------------|-------------------------------------|
 * | Console    | development | Prints emails to terminal (Logger)  |
 * | InMemory   | test        | Captures emails for test assertions |
 * | Resend     | production  | Delivers real emails via Resend API |
 *
 * ## Why an injection token instead of an abstract class?
 *
 * NestJS uses dependency injection. We need a way to tell NestJS
 * "when someone asks for the email provider, give them THIS implementation."
 *
 * An abstract class COULD work as a token, but a string token is simpler
 * and more explicit. You see `@Inject(EMAIL_PROVIDER)` and immediately
 * know it's a pluggable dependency.
 */

/** Injection token used by NestJS to resolve the active email provider */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

/** Everything needed to send a single email */
export interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** HTML body (for email clients that support HTML — most do) */
  html: string;
  /** Plain text body (fallback for email clients that don't render HTML) */
  text: string;
  /** Override the default "from" address (optional) */
  from?: string;
}

/**
 * The contract every email provider must implement.
 *
 * Just one method: `send()`. That's it.
 * Keep it simple — if we need batch sending later, we add a
 * `sendBatch()` method without breaking existing code.
 */
export interface EmailProvider {
  /**
   * Send a single email.
   *
   * Implementations should:
   * - NOT throw on delivery failure (emails are best-effort)
   * - Log errors internally (so we can debug delivery issues)
   * - Return void (callers don't care about delivery receipts)
   */
  send(options: SendEmailOptions): Promise<void>;
}
