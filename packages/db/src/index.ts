/**
 * # Database Package
 *
 * Re-exports PrismaClient and all generated types from the Prisma 7 generated client.
 * Import from `@paisa/db` instead of directly from the generated path.
 *
 * ## Prisma 7 Changes
 *
 * - Client is generated to `src/generated/prisma/` (not node_modules)
 * - Requires a driver adapter (`@prisma/adapter-pg`) instead of the Rust engine
 * - Connection URL is passed to the adapter, not read from env automatically
 *
 * ## Usage
 *
 * ```typescript
 * import { PrismaClient, PrismaPg } from '@paisa/db';
 * import type { User, Role } from '@paisa/db';
 * ```
 */

// Prisma 7 generated client — PrismaClient + all model types + enums
export {
  PrismaClient,
  Role,
  SubscriptionStatus,
} from './generated/prisma/client';

export type {
  User,
  OAuthAccount,
  Passkey,
  TwoFactorAuth,
  RefreshToken,
  StripeCustomer,
  Product,
  Plan,
  Subscription,
  FeatureFlag,
  AuditLog,
} from './generated/prisma/client';

// Prisma 7 PostgreSQL driver adapter
export { PrismaPg } from '@prisma/adapter-pg';
