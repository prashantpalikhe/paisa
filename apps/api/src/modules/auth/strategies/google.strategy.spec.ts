/**
 * # GoogleStrategy Unit Tests
 *
 * Tests the validate() method which extracts data from the Google
 * profile and delegates to AuthService.handleOAuthLogin().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from './google.strategy';
import type { Profile } from 'passport-google-oauth20';

// ── Mocks ──

const mockConfig = {
  features: {
    auth: {
      google: {
        enabled: true,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackUrl: 'http://localhost:3001/auth/google/callback',
      },
    },
  },
};

const mockAuthService = {
  handleOAuthLogin: vi.fn(),
};

/** Helper to create a Google profile object */
function makeGoogleProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'google-123',
    displayName: 'Test User',
    emails: [{ value: 'test@gmail.com', verified: 'true' }],
    photos: [{ value: 'https://lh3.googleusercontent.com/photo.jpg' }],
    provider: 'google',
    profileUrl: '',
    _raw: '',
    _json: {} as any,
    ...overrides,
  };
}

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new GoogleStrategy(mockConfig as any, mockAuthService as any);
  });

  it('should extract profile data and call handleOAuthLogin', async () => {
    const oauthResult = {
      user: { id: 'user-1', email: 'test@gmail.com' },
      tokenPair: { accessToken: 'jwt', expiresIn: 900, refreshToken: 'refresh' },
      isNewUser: true,
    };
    mockAuthService.handleOAuthLogin.mockResolvedValue(oauthResult);

    const profile = makeGoogleProfile();
    const done = vi.fn();

    await strategy.validate('google-access-token', 'google-refresh-token', profile, done);

    // Should call handleOAuthLogin with extracted profile data
    expect(mockAuthService.handleOAuthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        providerUserId: 'google-123',
        email: 'test@gmail.com',
        name: 'Test User',
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
      }),
      expect.any(Object),
    );

    // Should pass the result to Passport's done callback
    expect(done).toHaveBeenCalledWith(null, oauthResult);
  });

  it('should handle profile without photo gracefully', async () => {
    const oauthResult = {
      user: { id: 'user-1' },
      tokenPair: { accessToken: 'jwt', expiresIn: 900, refreshToken: 'refresh' },
      isNewUser: false,
    };
    mockAuthService.handleOAuthLogin.mockResolvedValue(oauthResult);

    const profile = makeGoogleProfile({ photos: undefined });
    const done = vi.fn();

    await strategy.validate('token', 'refresh', profile, done);

    expect(mockAuthService.handleOAuthLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: undefined,
      }),
      expect.any(Object),
    );
    expect(done).toHaveBeenCalledWith(null, oauthResult);
  });

  it('should call done with error when no email in profile', async () => {
    const profile = makeGoogleProfile({ emails: [] });
    const done = vi.fn();

    await strategy.validate('token', 'refresh', profile, done);

    // Should pass the error to done
    expect(done).toHaveBeenCalledWith(
      expect.any(UnauthorizedException),
      undefined,
    );
    expect(mockAuthService.handleOAuthLogin).not.toHaveBeenCalled();
  });

  it('should call done with error when handleOAuthLogin throws', async () => {
    mockAuthService.handleOAuthLogin.mockRejectedValue(
      new UnauthorizedException('Account suspended'),
    );

    const profile = makeGoogleProfile();
    const done = vi.fn();

    await strategy.validate('token', 'refresh', profile, done);

    expect(done).toHaveBeenCalledWith(
      expect.any(UnauthorizedException),
      undefined,
    );
  });
});
