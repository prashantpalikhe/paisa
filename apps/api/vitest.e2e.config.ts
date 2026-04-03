import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

/**
 * # E2E Test Configuration
 *
 * Separate from unit test config because e2e tests:
 * - Boot the real NestJS app (slower, needs a real database)
 * - Have a longer timeout (30s vs default 5s)
 * - Run a global setup that applies Prisma migrations
 * - Must run sequentially (shared database)
 *
 * ## Environment
 *
 * Test env vars are defined in `.env.test` (committed to git, no secrets).
 * This avoids duplicating the test database URL in multiple places.
 *
 * Run with: `pnpm test:e2e`
 */
export default defineConfig(({ mode }) => {
  // Load .env.test from the api app directory.
  // loadEnv reads .env.[mode] files — we pass 'test' as the mode.
  const env = loadEnv(mode || 'test', __dirname, '');

  return {
    test: {
      globals: false, // Explicit imports from 'vitest' — clearer, no ambient type issues
      root: './',
      include: ['test/e2e/**/*.spec.ts'],
      environment: 'node',

      // ── Timeouts ──
      // E2e tests boot a real app + hit a real DB. They're slower than unit tests.
      testTimeout: 30_000, // 30s per test
      hookTimeout: 30_000, // 30s for beforeAll/afterAll (app boot + DB setup)

      // ── Global setup ──
      // Runs ONCE before all test files:
      // 1. Waits for Postgres to be ready
      // 2. Sets DATABASE_URL to the test database
      // 3. Runs prisma migrate deploy
      globalSetup: ['./test/setup/global-setup.ts'],

      // ── Environment variables ──
      // Loaded from .env.test, with DATABASE_URL overridden to the test DB.
      // Single source of truth — no duplication.
      env: {
        ...env,
        DATABASE_URL: env.DATABASE_URL_TEST,
      },

      // ── Sequencing ──
      // Run test files sequentially, not in parallel.
      // Why: All e2e tests share one database. Parallel test files would
      // truncate each other's data mid-test. Unit tests can run in parallel
      // because they use mocks, but e2e tests cannot.
      fileParallelism: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
