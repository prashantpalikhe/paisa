/**
 * # UserService Unit Tests
 *
 * Tests user CRUD operations and password hashing.
 * DatabaseService is MOCKED — we're testing UserService logic,
 * not Prisma queries.
 *
 * ## What we test
 *
 * - create(): email normalization, password hashing, null password (OAuth)
 * - findByEmail(): delegates to Prisma, normalizes email
 * - findById(): delegates to Prisma
 * - verifyPassword(): correct password, wrong password, no password (OAuth user)
 * - updatePassword(): hashes before storing
 * - markEmailVerified(): sets flag and timestamp
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service';
import * as argon2 from 'argon2';

// ── Mock DatabaseService ──
// We don't want real DB calls in unit tests.
// Each test configures the mock's return value for its scenario.
const mockDb = {
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  oAuthAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  // $transaction executes the callback with the same mock db (simplified)
  $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockDb)),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    // Reset all mocks between tests so they don't leak state
    vi.clearAllMocks();

    // Create a fresh service with the mocked DB
    service = new UserService(mockDb as any);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // create()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should create a user with hashed password', async () => {
    // Arrange: mock Prisma's create to return a fake user
    const fakeUser = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: '$argon2id$...',
      name: 'Test',
    };
    mockDb.user.create.mockResolvedValue(fakeUser);

    // Act
    const result = await service.create({
      email: 'Test@Example.com', // Mixed case — should be normalized
      password: 'MyPassword123',
      name: '  Test  ', // Whitespace — should be trimmed
    });

    // Assert: user was created
    expect(result).toEqual(fakeUser);

    // Assert: Prisma was called with normalized email and hashed password
    const createCall = mockDb.user.create.mock.calls[0][0];
    expect(createCall.data.email).toBe('test@example.com'); // Lowercased + trimmed
    expect(createCall.data.name).toBe('Test'); // Trimmed
    // Password should be hashed (starts with $argon2id$)
    expect(createCall.data.passwordHash).toMatch(/^\$argon2id\$/);
    // The hash should NOT be the plaintext password
    expect(createCall.data.passwordHash).not.toBe('MyPassword123');
  });

  it('should create a user with null password (OAuth flow)', async () => {
    const fakeUser = { id: 'user-2', email: 'oauth@example.com', passwordHash: null };
    mockDb.user.create.mockResolvedValue(fakeUser);

    await service.create({ email: 'oauth@example.com' });

    // No password → passwordHash should be null
    const createCall = mockDb.user.create.mock.calls[0][0];
    expect(createCall.data.passwordHash).toBeNull();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // findByEmail()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should find user by email (case-insensitive)', async () => {
    const fakeUser = { id: 'user-1', email: 'test@example.com' };
    mockDb.user.findUnique.mockResolvedValue(fakeUser);

    const result = await service.findByEmail('TEST@Example.com');

    expect(result).toEqual(fakeUser);
    // Should normalize the email before querying
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
    });
  });

  it('should return null when user not found', async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const result = await service.findByEmail('nobody@example.com');

    expect(result).toBeNull();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // verifyPassword()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return true for correct password', async () => {
    // Hash a known password so we can verify against it
    const hash = await argon2.hash('CorrectPassword1');
    const user = { passwordHash: hash } as any;

    const result = await service.verifyPassword(user, 'CorrectPassword1');

    expect(result).toBe(true);
  });

  it('should return false for wrong password', async () => {
    const hash = await argon2.hash('CorrectPassword1');
    const user = { passwordHash: hash } as any;

    const result = await service.verifyPassword(user, 'WrongPassword1');

    expect(result).toBe(false);
  });

  it('should return false for OAuth user (no password)', async () => {
    // OAuth users have passwordHash = null
    const user = { passwordHash: null } as any;

    const result = await service.verifyPassword(user, 'AnyPassword1');

    expect(result).toBe(false);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // updatePassword()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should hash the new password before storing', async () => {
    mockDb.user.update.mockResolvedValue({});

    await service.updatePassword('user-1', 'NewPassword123');

    const updateCall = mockDb.user.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe('user-1');
    // Should be hashed, not plaintext
    expect(updateCall.data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(updateCall.data.passwordHash).not.toBe('NewPassword123');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // markEmailVerified()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should set emailVerified and emailVerifiedAt', async () => {
    const fakeUser = { id: 'user-1', emailVerified: true };
    mockDb.user.update.mockResolvedValue(fakeUser);

    const result = await service.markEmailVerified('user-1');

    expect(result.emailVerified).toBe(true);
    const updateCall = mockDb.user.update.mock.calls[0][0];
    expect(updateCall.data.emailVerified).toBe(true);
    expect(updateCall.data.emailVerifiedAt).toBeInstanceOf(Date);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // findOrCreateOAuthUser()
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const googleProfile = {
    provider: 'google' as const,
    providerUserId: 'google-123',
    email: 'oauth@example.com',
    name: 'OAuth User',
    avatarUrl: 'https://example.com/photo.jpg',
    accessToken: 'google-access-token',
    refreshToken: 'google-refresh-token',
  };

  it('should return existing user when OAuthAccount already exists', async () => {
    const existingUser = { id: 'user-3', email: 'oauth@example.com' };
    mockDb.oAuthAccount.findUnique.mockResolvedValue({
      id: 'oauth-1',
      user: existingUser,
      accessToken: 'old-token',
      refreshToken: 'old-refresh',
      expiresAt: null,
    });
    mockDb.oAuthAccount.update.mockResolvedValue({});

    const result = await service.findOrCreateOAuthUser(googleProfile);

    expect(result.user).toEqual(existingUser);
    expect(result.isNewUser).toBe(false);

    // Should update the stored OAuth tokens
    expect(mockDb.oAuthAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'oauth-1' },
        data: expect.objectContaining({
          accessToken: 'google-access-token',
        }),
      }),
    );

    // Should NOT create a new user or OAuth account
    expect(mockDb.user.create).not.toHaveBeenCalled();
    expect(mockDb.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it('should link OAuth account to existing user with same email', async () => {
    // No existing OAuthAccount for this provider
    mockDb.oAuthAccount.findUnique.mockResolvedValue(null);
    // But a user with this email exists (registered with email/password)
    const existingUser = {
      id: 'user-4',
      email: 'oauth@example.com',
      name: 'Existing User',
      avatarUrl: null,
      emailVerifiedAt: null,
    };
    mockDb.user.findUnique.mockResolvedValue(existingUser);
    const updatedUser = { ...existingUser, emailVerified: true, avatarUrl: 'https://example.com/photo.jpg' };
    mockDb.user.update.mockResolvedValue(updatedUser);

    const result = await service.findOrCreateOAuthUser(googleProfile);

    expect(result.user.emailVerified).toBe(true);
    expect(result.user.avatarUrl).toBe('https://example.com/photo.jpg');
    expect(result.isNewUser).toBe(false);

    // Should create the OAuthAccount link
    expect(mockDb.oAuthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-4',
          provider: 'google',
          providerUserId: 'google-123',
        }),
      }),
    );

    // Should auto-verify the email
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailVerified: true,
        }),
      }),
    );
  });

  it('should create new user when no matching email exists', async () => {
    // No existing OAuthAccount
    mockDb.oAuthAccount.findUnique.mockResolvedValue(null);
    // No existing user with this email
    mockDb.user.findUnique.mockResolvedValue(null);
    // Transaction creates the user
    const newUser = {
      id: 'user-5',
      email: 'oauth@example.com',
      name: 'OAuth User',
      passwordHash: null,
      emailVerified: true,
    };
    mockDb.user.create.mockResolvedValue(newUser);
    mockDb.oAuthAccount.create.mockResolvedValue({});

    const result = await service.findOrCreateOAuthUser(googleProfile);

    expect(result.user).toEqual(newUser);
    expect(result.isNewUser).toBe(true);

    // Should create user with no password and email pre-verified
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'oauth@example.com',
          passwordHash: null,
          emailVerified: true,
        }),
      }),
    );
  });
});
