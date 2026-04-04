/**
 * # GoogleOAuthGuard Unit Tests
 *
 * Tests that the guard checks the feature flag before delegating
 * to Passport's AuthGuard('google').
 */
import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GoogleOAuthGuard } from './google-oauth.guard';

// ── Mocks ──

function makeConfig(googleEnabled: boolean) {
  return {
    features: {
      auth: {
        google: { enabled: googleEnabled },
      },
    },
  };
}

/** Minimal ExecutionContext mock */
function makeContext() {
  return {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('GoogleOAuthGuard', () => {
  it('should throw NotFoundException when Google OAuth is disabled', () => {
    const guard = new GoogleOAuthGuard(makeConfig(false) as any);

    expect(() => guard.canActivate(makeContext())).toThrow(NotFoundException);
  });

  it('should delegate to AuthGuard when Google OAuth is enabled', async () => {
    const guard = new GoogleOAuthGuard(makeConfig(true) as any);

    // AuthGuard('google').canActivate() returns a Promise that will fail
    // without a real Passport setup. The important thing is that we get
    // past the feature flag check (no NotFoundException thrown synchronously).
    // We await the result and catch the Passport error.
    try {
      await guard.canActivate(makeContext());
    } catch (error) {
      // If it throws, it should NOT be a NotFoundException (it should be
      // a Passport-related error since we don't have a real strategy configured)
      expect(error).not.toBeInstanceOf(NotFoundException);
    }
  });
});
