/**
 * # JwtAuthGuard Unit Tests
 *
 * Tests that the global JWT guard:
 * - Skips authentication for @Public() routes
 * - Requires authentication for all other routes
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  /**
   * Helper to create a fake ExecutionContext.
   * In NestJS, the context carries info about the current request,
   * including which controller method is being called.
   */
  function createMockContext(): ExecutionContext {
    return {
      getHandler: vi.fn().mockReturnValue({}),
      getClass: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access for @Public() routes', () => {
    const context = createMockContext();
    // Simulate @Public() decorator being present
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should delegate to Passport for non-public routes', () => {
    const context = createMockContext();
    // No @Public() decorator
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    // Spy on the parent class (AuthGuard) to verify delegation
    // We can't fully test Passport in a unit test — that's what e2e tests are for.
    // Here we verify that @Public() is checked and the guard doesn't short-circuit.
    const superSpy = vi.spyOn(
      Object.getPrototypeOf(Object.getPrototypeOf(guard)),
      'canActivate',
    );

    // The super.canActivate() will fail because Passport isn't set up,
    // but we just need to verify it was called (delegation happened).
    try {
      guard.canActivate(context);
    } catch {
      // Expected — Passport isn't wired up in unit tests
    }

    expect(superSpy).toHaveBeenCalledWith(context);
  });
});
