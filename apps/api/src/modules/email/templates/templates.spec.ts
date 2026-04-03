/**
 * # Template Unit Tests
 *
 * Templates are pure functions — easy to test.
 * We verify that each returns the right subject, contains key content
 * in both HTML and plain text, and includes the brand name.
 */
import { describe, it, expect } from 'vitest';
import { brand } from '@paisa/config';
import {
  welcomeEmail,
  verifyEmail,
  emailVerifiedEmail,
  passwordResetEmail,
  passwordChangedEmail,
  oauthLinkedEmail,
} from './index';

describe('Email Templates', () => {
  // ─── Welcome Email ───

  describe('welcomeEmail', () => {
    const result = welcomeEmail('Alice', 'https://app.test/verify?token=abc');

    it('should include brand name in subject', () => {
      expect(result.subject).toContain(brand.name);
    });

    it('should include verify URL in HTML and text', () => {
      expect(result.html).toContain('https://app.test/verify?token=abc');
      expect(result.text).toContain('https://app.test/verify?token=abc');
    });

    it('should greet the user by name', () => {
      expect(result.html).toContain('Hi Alice,');
      expect(result.text).toContain('Hi Alice,');
    });

    it('should use generic greeting when name is null', () => {
      const noName = welcomeEmail(null, 'https://app.test/verify?token=abc');
      expect(noName.html).toContain('Hi there,');
      expect(noName.text).toContain('Hi there,');
    });
  });

  // ─── Verify Email ───

  describe('verifyEmail', () => {
    const result = verifyEmail('Bob', 'https://app.test/verify?token=xyz');

    it('should include verify URL', () => {
      expect(result.html).toContain('https://app.test/verify?token=xyz');
      expect(result.text).toContain('https://app.test/verify?token=xyz');
    });

    it('should not include welcome messaging', () => {
      expect(result.html).not.toContain('Welcome');
      expect(result.text).not.toContain('Welcome');
    });
  });

  // ─── Email Verified ───

  describe('emailVerifiedEmail', () => {
    const result = emailVerifiedEmail('user@example.com');

    it('should confirm verification', () => {
      expect(result.html).toContain('verified successfully');
      expect(result.text).toContain('verified successfully');
    });
  });

  // ─── Password Reset ───

  describe('passwordResetEmail', () => {
    const result = passwordResetEmail('Carol', 'https://app.test/reset?token=rst');

    it('should include reset URL', () => {
      expect(result.html).toContain('https://app.test/reset?token=rst');
      expect(result.text).toContain('https://app.test/reset?token=rst');
    });

    it('should mention expiry', () => {
      expect(result.html).toContain('1 hour');
      expect(result.text).toContain('1 hour');
    });

    it('should mention ignoring if not requested', () => {
      expect(result.text).toContain('safely ignore');
    });
  });

  // ─── Password Changed ───

  describe('passwordChangedEmail', () => {
    const result = passwordChangedEmail('Dave');

    it('should confirm password change', () => {
      expect(result.html).toContain('changed successfully');
      expect(result.text).toContain('changed successfully');
    });

    it('should suggest contacting support if not them', () => {
      expect(result.text).toContain('contact support');
    });
  });

  // ─── OAuth Linked ───

  describe('oauthLinkedEmail', () => {
    const result = oauthLinkedEmail('Eve', 'google');

    it('should capitalize provider name', () => {
      expect(result.subject).toContain('Google');
      expect(result.html).toContain('Google');
    });

    it('should mention the ability to sign in', () => {
      expect(result.text).toContain('sign in using Google');
    });
  });
});
