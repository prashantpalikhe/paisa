/**
 * # User Factory
 *
 * Creates User records in the test database with sensible defaults.
 * Every field can be overridden for specific test scenarios.
 *
 * ## Why factories instead of fixtures?
 *
 * - **Fixtures** are static JSON files — rigid, hard to customize per test
 * - **Factories** are functions — flexible, composable, type-safe
 *
 * ## How the counter works
 *
 * Each call increments a counter to generate unique emails.
 * Call `resetUserCounter()` in `beforeEach` if you need predictable values.
 *
 * ## Usage
 *
 * ```typescript
 * // Create a user with defaults
 * const user = await createUser(prisma);
 *
 * // Create an admin
 * const admin = await createUser(prisma, { role: 'ADMIN' });
 *
 * // Create a verified user with a specific email
 * const user = await createUser(prisma, {
 *   email: 'specific@example.com',
 *   emailVerified: true,
 * });
 * ```
 */
import { PrismaClient } from '@paisa/db';
import type { User } from '@paisa/db';

/** Auto-incrementing counter for unique email generation */
let counter = 0;

/**
 * Reset the counter to 0.
 * Call this in `beforeEach` if you need predictable, repeatable emails.
 */
export function resetUserCounter(): void {
  counter = 0;
}

/**
 * Fields that can be overridden when creating a test user.
 * Matches the Prisma User create input, minus auto-generated fields.
 */
export interface CreateUserOptions {
  email?: string;
  name?: string;
  passwordHash?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: Date | null;
  role?: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
  banned?: boolean;
  bannedAt?: Date | null;
  bannedReason?: string | null;
}

/**
 * Create a User in the test database.
 *
 * Returns the full Prisma User object (including generated id, timestamps).
 */
export async function createUser(
  prisma: PrismaClient,
  overrides: CreateUserOptions = {},
): Promise<User> {
  counter++;

  return prisma.user.create({
    data: {
      email: overrides.email ?? `test-user-${counter}@example.com`,
      name: overrides.name ?? `Test User ${counter}`,
      passwordHash: overrides.passwordHash ?? null,
      emailVerified: overrides.emailVerified ?? false,
      emailVerifiedAt: overrides.emailVerifiedAt ?? null,
      role: overrides.role ?? 'USER',
      avatarUrl: overrides.avatarUrl ?? null,
      banned: overrides.banned ?? false,
      bannedAt: overrides.bannedAt ?? null,
      bannedReason: overrides.bannedReason ?? null,
    },
  });
}
