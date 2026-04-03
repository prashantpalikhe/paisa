/**
 * # Database Reset Helper
 *
 * Truncates all application tables between test suites.
 * Gives each test file a clean slate without re-running migrations.
 *
 * ## How it works
 *
 * 1. Queries `pg_tables` for all tables in the `public` schema
 * 2. Excludes Prisma's internal migration tracking table (`_prisma_migrations`)
 * 3. Runs a single `TRUNCATE ... RESTART IDENTITY CASCADE` statement
 *
 * ## Why query the database instead of hardcoding table names?
 *
 * Hardcoded table lists go stale silently. When someone adds a new
 * Prisma model, they'd have to remember to update the list — and if
 * they forget, old data bleeds between tests causing flaky failures
 * that are extremely hard to debug.
 *
 * By querying `pg_tables`, we always get the current set of tables
 * automatically. Zero maintenance.
 *
 * ## Performance
 *
 * - `TRUNCATE` is ~5ms (deallocates pages, no row-by-row processing)
 * - `CASCADE` handles foreign keys automatically
 * - `RESTART IDENTITY` resets auto-increment sequences for predictable IDs
 *
 * ## Usage
 *
 * ```typescript
 * import { resetDatabase } from '../helpers';
 *
 * beforeEach(async () => {
 *   await resetDatabase(prismaClient);
 * });
 * ```
 */
import { PrismaClient } from '@paisa/db';

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // Query Postgres system catalog for all application tables.
  // Excludes:
  //   - _prisma_migrations: Prisma's migration tracking (must survive between tests)
  //   - Any system schemas (we only look at 'public')
  const tables: Array<{ tablename: string }> = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
  `;

  if (tables.length === 0) return;

  // Build a single atomic TRUNCATE for all tables.
  // Either all tables are truncated or none — no partial state.
  const tableList = tables.map((t) => `"${t.tablename}"`).join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}
