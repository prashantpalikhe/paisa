/**
 * # TokenService Unit Tests
 *
 * Tests JWT generation, refresh token rotation, and revocation.
 * All database calls are mocked.
 *
 * ## Key scenarios
 *
 * - Access token generation (JWT with correct payload)
 * - Refresh token creation (stored as hash in DB)
 * - Refresh token rotation (old revoked, new issued)
 * - Replay attack detection (revoked token reuse → family revoked)
 * - Expired token rejection
 * - Banned user rejection
 * - Token family revocation
 * - All-user token revocation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { createHash } from 'node:crypto';

// ── Mock JwtService ──
const mockJwt = {
  sign: vi.fn().mockReturnValue('mock-jwt-token'),
};

// ── Mock DatabaseService ──
const mockDb = {
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

// ── Mock AppConfigService ──
const mockConfig = {
  env: {
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  },
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenService(mockJwt as any, mockDb as any, mockConfig as any);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACCESS TOKEN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should generate an access token with correct payload', () => {
    const user = { id: 'user-1', email: 'test@example.com', role: 'USER' } as any;

    const result = service.generateAccessToken(user);

    // JWT.sign should be called with the payload
    expect(mockJwt.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'test@example.com',
      role: 'USER',
    });

    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.expiresIn).toBe(900); // 15m = 900 seconds
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFRESH TOKEN CREATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should generate a refresh token and store its hash', async () => {
    mockDb.refreshToken.create.mockResolvedValue({});
    const user = { id: 'user-1' } as any;

    const rawToken = await service.generateRefreshToken(user, null);

    // Raw token should be a hex string (64 bytes = 128 hex chars)
    expect(rawToken).toMatch(/^[0-9a-f]{128}$/);

    // DB should store the HASH, not the raw token
    const createCall = mockDb.refreshToken.create.mock.calls[0][0];
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');
    expect(createCall.data.tokenHash).toBe(expectedHash);
    expect(createCall.data.userId).toBe('user-1');
    expect(createCall.data.family).toBeDefined(); // Auto-generated family
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);
  });

  it('should use provided family when rotating', async () => {
    mockDb.refreshToken.create.mockResolvedValue({});
    const user = { id: 'user-1' } as any;

    await service.generateRefreshToken(user, 'existing-family');

    const createCall = mockDb.refreshToken.create.mock.calls[0][0];
    expect(createCall.data.family).toBe('existing-family');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFRESH TOKEN ROTATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should rotate: revoke old token, issue new ones', async () => {
    const rawToken = 'a'.repeat(128); // Fake token
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Mock: token found, not revoked, not expired
    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      tokenHash,
      family: 'family-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000), // Tomorrow
      user: { id: 'user-1', email: 'test@example.com', role: 'USER', banned: false },
    });
    mockDb.refreshToken.update.mockResolvedValue({}); // Revoke old
    mockDb.refreshToken.create.mockResolvedValue({}); // Create new

    const result = await service.rotateRefreshToken(rawToken);

    // Old token should be revoked
    expect(mockDb.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { revokedAt: expect.any(Date) },
    });

    // New access + refresh tokens should be issued
    expect(result.tokenPair.accessToken).toBe('mock-jwt-token');
    expect(result.tokenPair.refreshToken).toMatch(/^[0-9a-f]{128}$/);
    expect(result.user.id).toBe('user-1');

    // New refresh token should be in the same family
    const createCall = mockDb.refreshToken.create.mock.calls[0][0];
    expect(createCall.data.family).toBe('family-1');
  });

  it('should reject an invalid (not found) refresh token', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValue(null);

    await expect(
      service.rotateRefreshToken('invalid-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should detect replay attack: revoked token reuse → revoke family', async () => {
    const rawToken = 'b'.repeat(128);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Mock: token found but ALREADY REVOKED (replay attack!)
    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      tokenHash,
      family: 'family-1',
      userId: 'user-1',
      revokedAt: new Date(), // ← Already revoked!
      expiresAt: new Date(Date.now() + 86400000),
      user: { id: 'user-1', banned: false },
    });
    mockDb.refreshToken.updateMany.mockResolvedValue({});

    await expect(
      service.rotateRefreshToken(rawToken),
    ).rejects.toThrow('Refresh token has been revoked');

    // Entire family should be revoked
    expect(mockDb.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { family: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('should reject an expired refresh token', async () => {
    const rawToken = 'c'.repeat(128);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      tokenHash,
      family: 'family-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // ← Expired!
      user: { id: 'user-1', banned: false },
    });

    await expect(
      service.rotateRefreshToken(rawToken),
    ).rejects.toThrow('Refresh token has expired');
  });

  it('should reject and revoke tokens for banned user', async () => {
    const rawToken = 'd'.repeat(128);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    mockDb.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      tokenHash,
      family: 'family-1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: { id: 'user-1', banned: true }, // ← Banned!
    });
    mockDb.refreshToken.updateMany.mockResolvedValue({});

    await expect(
      service.rotateRefreshToken(rawToken),
    ).rejects.toThrow('Account has been suspended');

    // Family should be revoked
    expect(mockDb.refreshToken.updateMany).toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REVOCATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should revoke all tokens for a user', async () => {
    mockDb.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    await service.revokeAllUserTokens('user-1');

    expect(mockDb.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
