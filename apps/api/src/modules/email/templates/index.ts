/**
 * # Email Templates
 *
 * Pure functions that generate complete email content.
 * Each returns { subject, html, text } — ready to pass to the provider.
 *
 * ## Design principles
 *
 * - **Pure functions**: No side effects, no injected dependencies.
 *   Just data in, email content out. This makes them trivially testable.
 * - **Always include plain text**: Some users disable HTML emails,
 *   some email clients don't support it, and it helps with spam filters.
 * - **Brand-aware**: All templates use the shared base layout which
 *   reads from `@paisa/config/brand`.
 */
import { brand } from '@paisa/config';
import { baseLayout } from './base-layout';

/** Return type for all template functions */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// ─── Shared UI components ───

/** Generates a branded CTA button (the big colored button in emails) */
function ctaButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
      <tr>
        <td style="background-color: #18181b; border-radius: 6px; padding: 12px 32px;">
          <a href="${url}" style="color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Generates a paragraph with consistent styling */
function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #27272a;">${text}</p>`;
}

/** Generates a "can't click the button?" fallback with the raw URL */
function urlFallback(url: string): string {
  return `
    <p style="margin: 16px 0 0; font-size: 13px; color: #71717a; word-break: break-all;">
      Can't click the button? Copy and paste this URL into your browser:<br>
      <a href="${url}" style="color: #71717a;">${url}</a>
    </p>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEMPLATES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Welcome email — sent after a new user registers with email/password.
 * Includes the email verification link.
 *
 * NOT sent for OAuth registrations (their email is already verified).
 */
export function welcomeEmail(name: string | null, verifyUrl: string): EmailContent {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return {
    subject: `Welcome to ${brand.name}! Verify your email`,
    html: baseLayout({
      preheader: `Welcome to ${brand.name}! Please verify your email address.`,
      content: [
        paragraph(`${greeting}`),
        paragraph(`Welcome to <strong>${brand.name}</strong>! We're glad to have you.`),
        paragraph('Please verify your email address to get started:'),
        ctaButton('Verify Email', verifyUrl),
        paragraph('This link expires in 24 hours.'),
        urlFallback(verifyUrl),
      ].join('\n'),
    }),
    text: [
      greeting,
      '',
      `Welcome to ${brand.name}! We're glad to have you.`,
      '',
      'Please verify your email address by visiting this link:',
      verifyUrl,
      '',
      'This link expires in 24 hours.',
    ].join('\n'),
  };
}

/**
 * Verify email — sent when user requests to resend the verification.
 * Similar to welcome but without the "welcome" messaging.
 */
export function verifyEmail(name: string | null, verifyUrl: string): EmailContent {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return {
    subject: `Verify your email — ${brand.name}`,
    html: baseLayout({
      preheader: 'Verify your email address to continue.',
      content: [
        paragraph(`${greeting}`),
        paragraph('Please verify your email address:'),
        ctaButton('Verify Email', verifyUrl),
        paragraph('This link expires in 24 hours.'),
        urlFallback(verifyUrl),
      ].join('\n'),
    }),
    text: [
      greeting,
      '',
      'Please verify your email address by visiting this link:',
      verifyUrl,
      '',
      'This link expires in 24 hours.',
    ].join('\n'),
  };
}

/**
 * Email verified — confirmation that their email was verified.
 * Short and sweet — just a confirmation.
 */
export function emailVerifiedEmail(_email: string): EmailContent {
  return {
    subject: `Email verified — ${brand.name}`,
    html: baseLayout({
      preheader: 'Your email address has been verified.',
      content: [
        paragraph('Your email address has been verified successfully.'),
        paragraph(`You're all set to use ${brand.name}. No further action needed.`),
      ].join('\n'),
    }),
    text: [
      'Your email address has been verified successfully.',
      '',
      `You're all set to use ${brand.name}. No further action needed.`,
    ].join('\n'),
  };
}

/**
 * Password reset — sent when user requests a password reset.
 * Contains the reset link.
 */
export function passwordResetEmail(name: string | null, resetUrl: string): EmailContent {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return {
    subject: `Reset your password — ${brand.name}`,
    html: baseLayout({
      preheader: 'You requested a password reset.',
      content: [
        paragraph(`${greeting}`),
        paragraph('We received a request to reset your password. Click the button below to choose a new one:'),
        ctaButton('Reset Password', resetUrl),
        paragraph('This link expires in <strong>1 hour</strong>.'),
        paragraph('If you didn\'t request this, you can safely ignore this email. Your password won\'t be changed.'),
        urlFallback(resetUrl),
      ].join('\n'),
    }),
    text: [
      greeting,
      '',
      'We received a request to reset your password.',
      'Visit this link to choose a new one:',
      resetUrl,
      '',
      'This link expires in 1 hour.',
      '',
      "If you didn't request this, you can safely ignore this email.",
    ].join('\n'),
  };
}

/**
 * Password changed — security notification after password is changed.
 * Important: tells the user to contact support if they didn't do it.
 */
export function passwordChangedEmail(name: string | null): EmailContent {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return {
    subject: `Password changed — ${brand.name}`,
    html: baseLayout({
      preheader: 'Your password was changed successfully.',
      content: [
        paragraph(`${greeting}`),
        paragraph('Your password has been changed successfully.'),
        paragraph('If you did not make this change, please contact support immediately and reset your password.'),
      ].join('\n'),
    }),
    text: [
      greeting,
      '',
      'Your password has been changed successfully.',
      '',
      'If you did not make this change, please contact support immediately and reset your password.',
    ].join('\n'),
  };
}

/**
 * OAuth linked — notification when an OAuth provider is linked.
 * Security notification so the user knows their account changed.
 */
export function oauthLinkedEmail(name: string | null, provider: string): EmailContent {
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1); // "google" → "Google"

  return {
    subject: `${providerName} account linked — ${brand.name}`,
    html: baseLayout({
      preheader: `Your ${providerName} account has been linked.`,
      content: [
        paragraph(`${greeting}`),
        paragraph(`Your <strong>${providerName}</strong> account has been linked to your ${brand.name} account.`),
        paragraph(`You can now sign in using ${providerName}.`),
        paragraph('If you did not link this account, please contact support immediately.'),
      ].join('\n'),
    }),
    text: [
      greeting,
      '',
      `Your ${providerName} account has been linked to your ${brand.name} account.`,
      `You can now sign in using ${providerName}.`,
      '',
      'If you did not link this account, please contact support immediately.',
    ].join('\n'),
  };
}
