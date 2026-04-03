/**
 * # Email Module — Public Exports
 *
 * Re-exports for use by other modules and tests.
 * Import from here instead of reaching into internal files.
 */
export { EmailModule } from './email.module';
export { EMAIL_PROVIDER } from './providers/email-provider.interface';
export type { EmailProvider, SendEmailOptions } from './providers/email-provider.interface';
export { InMemoryEmailProvider } from './providers/in-memory-email.provider';
