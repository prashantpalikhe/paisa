/**
 * # RolesGuard Unit Tests
 *
 * Tests role-based access control:
 * - No @Roles() → anyone authenticated can access
 * - @Roles('ADMIN') → only ADMIN users can access
 * - @Roles('ADMIN') + USER user → 403 Forbidden
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(userRole?: string): ExecutionContext {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          user: userRole ? { role: userRole } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no @Roles() decorator is present', () => {
    const context = createMockContext('USER');
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ADMIN access to @Roles("ADMIN") route', () => {
    const context = createMockContext('ADMIN');
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny USER access to @Roles("ADMIN") route', () => {
    const context = createMockContext('USER');
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow when user has any of the required roles', () => {
    const context = createMockContext('ADMIN');
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['USER', 'ADMIN']);

    expect(guard.canActivate(context)).toBe(true);
  });
});
