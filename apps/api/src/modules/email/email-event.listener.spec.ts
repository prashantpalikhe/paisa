/**
 * # EmailEventListener Unit Tests
 *
 * Tests that each domain event handler:
 * 1. Sends the right email to the right address
 * 2. Includes the expected content (URL, name, etc.)
 * 3. Does NOT throw when the provider fails (best-effort)
 * 4. Skips emails when appropriate (e.g., OAuth registrations)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailEventListener } from './email-event.listener';

// ── Mock email provider ──
const mockProvider = {
  send: vi.fn().mockResolvedValue(undefined),
};

// ── Mock config ──
const mockConfig = {
  env: {
    FRONTEND_URL: 'https://app.test',
  },
};

describe('EmailEventListener', () => {
  let listener: EmailEventListener;

  beforeEach(() => {
    vi.clearAllMocks();
    listener = new EmailEventListener(mockProvider as any, mockConfig as any);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER_REGISTERED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should send welcome email on user.registered', async () => {
    await listener.onUserRegistered({
      userId: 'user-1',
      email: 'new@example.com',
      name: 'Alice',
      verificationToken: 'abc123',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: expect.stringContaining('Welcome'),
        html: expect.stringContaining('https://app.test/verify-email?token=abc123'),
        text: expect.stringContaining('https://app.test/verify-email?token=abc123'),
      }),
    );
  });

  it('should skip welcome email for OAuth registrations', async () => {
    await listener.onUserRegistered({
      userId: 'user-2',
      email: 'oauth@example.com',
      name: 'Bob',
      oauthProvider: 'google',
    });

    expect(mockProvider.send).not.toHaveBeenCalled();
  });

  it('should skip when no verification token', async () => {
    await listener.onUserRegistered({
      userId: 'user-3',
      email: 'notoken@example.com',
      name: null,
    });

    expect(mockProvider.send).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER_VERIFICATION_RESENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should send verify email on verification resent', async () => {
    await listener.onVerificationResent({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Carol',
      verificationToken: 'xyz789',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        html: expect.stringContaining('https://app.test/verify-email?token=xyz789'),
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER_VERIFIED_EMAIL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should send confirmation on email verified', async () => {
    await listener.onEmailVerified({
      userId: 'user-1',
      email: 'user@example.com',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        html: expect.stringContaining('verified'),
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER_PASSWORD_RESET_REQUESTED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should send password reset email', async () => {
    await listener.onPasswordResetRequested({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Dave',
      resetToken: 'reset123',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Reset'),
        html: expect.stringContaining('https://app.test/reset-password?token=reset123'),
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER_PASSWORD_CHANGED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should send password changed notification', async () => {
    await listener.onPasswordChanged({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Eve',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        html: expect.stringContaining('changed'),
      }),
    );
  });

  it('should skip password changed email when no email in payload', async () => {
    await listener.onPasswordChanged({
      userId: 'user-1',
      email: undefined as any,
      name: null,
    });

    expect(mockProvider.send).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USER_OAUTH_LINKED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should send OAuth linked notification', async () => {
    await listener.onOAuthLinked({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Frank',
      provider: 'google',
    });

    expect(mockProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Google'),
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERROR HANDLING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should NOT throw when provider fails', async () => {
    mockProvider.send.mockRejectedValueOnce(new Error('Resend API down'));

    // This should log the error but NOT throw
    await expect(
      listener.onUserRegistered({
        userId: 'user-1',
        email: 'user@example.com',
        name: 'Test',
        verificationToken: 'token',
      }),
    ).resolves.not.toThrow();
  });
});
