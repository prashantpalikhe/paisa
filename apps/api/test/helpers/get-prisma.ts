/**
 * # Get Prisma Client from NestJS App
 *
 * Extracts the DatabaseService (which extends PrismaClient) from
 * a running NestJS application instance.
 *
 * ## Why this helper?
 *
 * E2e tests need the Prisma client for two things:
 * 1. `resetDatabase(prisma)` — truncate tables between tests
 * 2. Factory functions — `createUser(prisma)`, `createProduct(prisma)`, etc.
 *
 * We could create a separate PrismaClient, but that would mean TWO
 * database connections — one inside NestJS, one in the test. Using
 * the same instance ensures we see exactly what the app sees.
 *
 * ## Usage
 *
 * ```typescript
 * import { createTestApp, getPrisma } from '../helpers';
 *
 * const app = await createTestApp();
 * const prisma = getPrisma(app);
 *
 * await resetDatabase(prisma);
 * const user = await createUser(prisma);
 * ```
 */
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@paisa/db';
import { DatabaseService } from '../../src/core/database/database.service';

export function getPrisma(app: INestApplication): PrismaClient {
  return app.get(DatabaseService);
}
