/**
 * # Playwright Test Fixtures
 *
 * Extends Playwright's base `test` object with custom fixtures
 * that every e2e test needs:
 *
 * - **resetDb** (auto): Resets the database + email inbox before each test
 * - **api**: Pre-configured API request context for direct API calls
 *
 * ## Usage
 *
 * ```typescript
 * import { test, expect } from '../fixtures'
 *
 * test('register flow', async ({ page, api }) => {
 *   // resetDb already ran automatically
 *   // `api` is ready for direct API calls
 * })
 * ```
 *
 * ## Why fixtures instead of beforeEach?
 *
 * Playwright fixtures are composable, type-safe, and lazy.
 * They only set up what the test actually uses.
 * `auto: true` fixtures run for every test without explicit opt-in.
 */
import { test as base, expect, type APIRequestContext } from '@playwright/test'

/** Standard test user credentials — used across all auth tests */
export const TEST_USER = {
  email: 'test@example.com',
  password: 'Password123',
  name: 'Test User',
} as const

const API_BASE_URL = 'http://localhost:3001'

// ─── Extend Playwright's test with custom fixtures ───

type Fixtures = {
  /** Automatically resets database and emails before each test */
  resetDb: void
  /** Pre-configured API request context (hits the NestJS API directly) */
  api: APIRequestContext
}

export const test = base.extend<Fixtures>({
  /**
   * Auto-fixture: runs before every test.
   * 1. Resets all database tables (TRUNCATE)
   * 2. Clears the email inbox (InMemoryEmailProvider)
   *
   * This gives each test a completely clean slate.
   */
  resetDb: [async ({ request }, use) => {
    // Reset database
    await request.post(`${API_BASE_URL}/test/reset-database`)
    // Clear email inbox
    await request.delete(`${API_BASE_URL}/test/emails`)
    // Hand control to the test
    await use()
  }, { auto: true }],

  /**
   * API request context for making direct calls to the NestJS API.
   * Used to set up test data (e.g., register a user) without going
   * through the browser UI.
   */
  api: async ({ playwright }, use) => {
    const apiContext = await playwright.request.newContext({
      baseURL: API_BASE_URL,
    })
    await use(apiContext)
    await apiContext.dispose()
  },
})

export { expect }
