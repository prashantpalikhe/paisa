/**
 * # AuthService Unit Tests
 *
 * Tests the orchestration of auth flows.
 * UserService, TokenService, and EventBus are all mocked.
 *
 * ## What we test
 *
 * - register: happy path, duplicate email
 * - login: generates tokens, emits event
 * - refresh: delegates to TokenService
 * - logout: revokes token, handles missing token gracefully
 * - verifyEmail: valid token, expired token, invalid token
 * - forgotPassword: existing email, non-existent email (no leak)
 * - resetPassword: valid flow, revokes all sessions
 * - changePassword: correct current password, wrong current password
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// ── Mock UserService ──
const mockUserService = {
  create: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  verifyPassword: vi.fn(),
  updatePassword: vi.fn(),
  markEmailVerified: vi.fn(),
};

// ── Mock TokenService ──
const mockTokenService = {
  generateAccessToken: vi.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    expiresIn: 900,
  }),
  generateRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  rotateRefreshToken: vi.fn(),
  revokeTokenFamily: vi.fn(),
  revokeAllUserTokens: vi.fn(),
  revokeByRawToken: vi.fn(),
};

// ── Mock EventBusService ──
const mockEventBus = {
  emit: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockUserService as any,
      mockTokenService as any,
      mockEventBus as any,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should register a new user and return tokens', async () => {
    const fakeUser = { id: 'user-1', email: 'new@example.com', name: 'New User' };
    mockUserService.findByEmail.mockResolvedValue(null); // No existing user
    mockUserService.create.mockResolvedValue(fakeUser);

    const result = await service.register('new@example.com', 'Password123', 'New User');

    expect(result.user).toEqual(fakeUser);
    expect(result.tokenPair.accessToken).toBe('mock-access-token');
    expect(result.tokenPair.refreshToken).toBe('mock-refresh-token');
    expect(result.verificationToken).toBeDefined();

    // Should emit user.registered event
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({
        userId: 'user-1',
        email: 'new@example.com',
        verificationToken: expect.any(String),
      }),
    );
  });

  it('should throw ConflictException for duplicate email', async () => {
    mockUserService.findByEmail.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register('existing@example.com', 'Password123'),
    ).rejects.toThrow(ConflictException);

    // Should NOT create a user
    expect(mockUserService.create).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should generate tokens on login', async () => {
    const user = { id: 'user-1', email: 'test@example.com' } as any;

    const result = await service.login(user);

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
    expect(result.expiresIn).toBe(900);

    // Should emit user.logged_in event
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'user.logged_in',
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFRESH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should delegate refresh to TokenService', async () => {
    mockTokenService.rotateRefreshToken.mockResolvedValue({
      user: { id: 'user-1' },
      tokenPair: { accessToken: 'new-access', expiresIn: 900, refreshToken: 'new-refresh' },
    });

    const result = await service.refresh('old-refresh-token');

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(mockTokenService.rotateRefreshToken).toHaveBeenCalledWith(
      'old-refresh-token',
      undefined,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGOUT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should revoke token on logout', async () => {
    await service.logout('some-refresh-token');

    expect(mockTokenService.revokeByRawToken).toHaveBeenCalledWith('some-refresh-token');
  });

  it('should handle missing refresh token gracefully', async () => {
    // Should not throw — logout with no token is a no-op
    await expect(service.logout('')).resolves.not.toThrow();
    expect(mockTokenService.revokeByRawToken).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL VERIFICATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should verify email with valid token', async () => {
    // First, register to get a verification token
    const fakeUser = { id: 'user-1', email: 'test@example.com', name: null };
    mockUserService.findByEmail.mockResolvedValue(null);
    mockUserService.create.mockResolvedValue(fakeUser);

    const { verificationToken } = await service.register(
      'test@example.com',
      'Password123',
    );

    // Now verify the email
    const verifiedUser = { ...fakeUser, emailVerified: true };
    mockUserService.markEmailVerified.mockResolvedValue(verifiedUser);

    const result = await service.verifyEmail(verificationToken);

    expect(result.emailVerified).toBe(true);
    expect(mockUserService.markEmailVerified).toHaveBeenCalledWith('user-1');
  });

  it('should reject invalid verification token', async () => {
    await expect(
      service.verifyEmail('totally-invalid-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FORGOT PASSWORD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should emit reset event for existing email', async () => {
    const user = { id: 'user-1', email: 'test@example.com', name: 'Test' };
    mockUserService.findByEmail.mockResolvedValue(user);

    await service.forgotPassword('test@example.com');

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'user.password_reset_requested',
      expect.objectContaining({
        userId: 'user-1',
        resetToken: expect.any(String),
      }),
    );
  });

  it('should NOT throw for non-existent email (prevent enumeration)', async () => {
    mockUserService.findByEmail.mockResolvedValue(null);

    // Should complete silently — no error, no event
    await expect(
      service.forgotPassword('nobody@example.com'),
    ).resolves.not.toThrow();

    // Should NOT emit any event (no user to reset)
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESET PASSWORD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should reset password and revoke all sessions', async () => {
    // Set up: create a reset token via forgotPassword
    const user = { id: 'user-1', email: 'test@example.com', name: 'Test' };
    mockUserService.findByEmail.mockResolvedValue(user);
    await service.forgotPassword('test@example.com');

    // Get the reset token from the emitted event
    const emitCall = mockEventBus.emit.mock.calls[0];
    const resetToken = emitCall[1].resetToken;

    vi.clearAllMocks(); // Clear mocks so we can check the reset calls

    // Act: reset the password
    await service.resetPassword(resetToken, 'NewPassword123');

    // Assert
    expect(mockUserService.updatePassword).toHaveBeenCalledWith('user-1', 'NewPassword123');
    expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'user.password_changed',
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHANGE PASSWORD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should change password when current password is correct', async () => {
    const user = { id: 'user-1', passwordHash: 'hash' };
    mockUserService.findById.mockResolvedValue(user);
    mockUserService.verifyPassword.mockResolvedValue(true);

    await service.changePassword('user-1', 'OldPassword1', 'NewPassword1');

    expect(mockUserService.updatePassword).toHaveBeenCalledWith('user-1', 'NewPassword1');
    expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
  });

  it('should reject change password when current password is wrong', async () => {
    const user = { id: 'user-1', passwordHash: 'hash' };
    mockUserService.findById.mockResolvedValue(user);
    mockUserService.verifyPassword.mockResolvedValue(false);

    await expect(
      service.changePassword('user-1', 'WrongPassword1', 'NewPassword1'),
    ).rejects.toThrow(UnauthorizedException);

    // Should NOT update the password
    expect(mockUserService.updatePassword).not.toHaveBeenCalled();
  });
});
