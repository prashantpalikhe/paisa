/**
 * # GoogleOAuthGuard Unit Tests
 *
 * Tests that the guard:
 * 1. Checks the feature flag before delegating to Passport
 * 2. Redirects to frontend on OAuth error (instead of returning JSON)
 */
import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GoogleOAuthGuard } from './google-oauth.guard';

// ── Mocks ──

function makeConfig(googleEnabled: boolean) {
  return {
    features: {
      auth: {
        google: { enabled: googleEnabled },
      },
    },
    env: {
      FRONTEND_URL: 'http://localhost:3000',
    },
  };
}

/** Minimal ExecutionContext mock */
function makeContext() {
  const mockRedirect = vi.fn();
  return {
    ctx: {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({ redirect: mockRedirect }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any,
    mockRedirect,
  };
}

describe('GoogleOAuthGuard', () => {
  it('should throw NotFoundException when Google OAuth is disabled', () => {
    const guard = new GoogleOAuthGuard(makeConfig(false) as any);
    const { ctx } = makeContext();

    expect(() => guard.canActivate(ctx)).toThrow(NotFoundException);
  });

  it('should delegate to AuthGuard when Google OAuth is enabled', async () => {
    const guard = new GoogleOAuthGuard(makeConfig(true) as any);
    const { ctx } = makeContext();

    // AuthGuard('google').canActivate() will fail without a real Passport setup.
    // The important thing is we get past the feature flag check.
    try {
      await guard.canActivate(ctx);
    } catch (error) {
      expect(error).not.toBeInstanceOf(NotFoundException);
    }
  });

  it('should redirect to frontend on OAuth error and throw', () => {
    const guard = new GoogleOAuthGuard(makeConfig(true) as any);
    const { ctx, mockRedirect } = makeContext();

    // Simulate Passport calling handleRequest with an error
    expect(() =>
      guard.handleRequest(
        new Error('Token exchange failed'),
        null,
        null,
        ctx,
      ),
    ).toThrow(UnauthorizedException);

    expect(mockRedirect).toHaveBeenCalledWith(
      'http://localhost:3000/auth/callback?error=oauth_failed',
    );
  });

  it('should redirect when user is null (denied consent)', () => {
    const guard = new GoogleOAuthGuard(makeConfig(true) as any);
    const { ctx, mockRedirect } = makeContext();

    expect(() => guard.handleRequest(null, null, null, ctx)).toThrow(
      UnauthorizedException,
    );

    expect(mockRedirect).toHaveBeenCalledWith(
      'http://localhost:3000/auth/callback?error=oauth_failed',
    );
  });

  it('should return user on successful OAuth', () => {
    const guard = new GoogleOAuthGuard(makeConfig(true) as any);
    const { ctx } = makeContext();

    const oauthResult = { user: { id: '1' }, tokenPair: {}, isNewUser: false };
    const result = guard.handleRequest(null, oauthResult, null, ctx);

    expect(result).toEqual(oauthResult);
  });
});
