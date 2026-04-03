/**
 * # Playwright E2E Configuration
 *
 * Runs full user-flow tests through a real browser against
 * both the API (NestJS, port 3001) and frontend (Nuxt, port 3000).
 *
 * ## How it works
 *
 * 1. `globalSetup` waits for postgres-test + runs migrations
 * 2. `webServer` array starts both API and Nuxt dev servers
 * 3. Tests run in Chromium, hitting localhost:3000
 * 4. Before each test, a fixture calls POST /test/reset-database
 *
 * ## Running
 *
 * ```bash
 * # Ensure postgres-test is running
 * docker compose -f docker/docker-compose.yml up -d postgres-test
 *
 * # Run all e2e tests
 * pnpm test:e2e:web
 *
 * # Run with UI mode (for debugging)
 * pnpm test:e2e:web -- --ui
 * ```
 */
import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/** Env vars for the API server (test mode) */
const apiEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://paisa_test:paisa_test@localhost:5433/paisa_test',
  JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long',
  API_BASE_URL: 'http://localhost:3001',
  FRONTEND_URL: 'http://localhost:3000',
  ADMIN_URL: 'http://localhost:3002',
  FEATURE_EMAIL_ENABLED: 'true',
}

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),

  // ─── Execution ───
  fullyParallel: false, // Shared database → sequential
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,

  // ─── Reporting ───
  reporter: process.env.CI ? 'github' : 'html',

  // ─── Browser config ───
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry', // Captures trace only on failures
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ─── Server orchestration ───
  // Playwright starts both servers before tests and stops them after.
  // `reuseExistingServer: true` in dev lets you keep servers running
  // for faster iteration (only launches if port is not in use).
  webServer: [
    {
      command: 'pnpm --filter @paisa/api dev',
      url: 'http://localhost:3001/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(__dirname, '..'),
      env: apiEnv,
    },
    {
      command: 'pnpm --filter @paisa/web dev',
      url: 'http://localhost:3000',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(__dirname, '..'),
      env: {
        NUXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
      },
    },
  ],
})
