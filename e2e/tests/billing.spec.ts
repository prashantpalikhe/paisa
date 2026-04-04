/**
 * # Billing / Pricing E2E Tests
 *
 * Tests for the pricing page, billing settings, checkout result pages,
 * and feature flag gating.
 *
 * ## Constraints
 *
 * - Stripe is NOT enabled in the test environment (no FEATURE_STRIPE_ENABLED=true).
 *   The StripeModule is not loaded, so /stripe/* endpoints do not exist.
 * - We CANNOT test actual Stripe Checkout or Portal (hosted external pages).
 * - We CAN test: feature flag gating, navigation, route protection,
 *   checkout success/cancel result pages, and the billing settings page UI.
 *
 * ## Selector strategy
 *
 * - Form inputs: `page.locator('#id')` (reliable with shadcn-vue)
 * - Headings/buttons: `getByRole()` (semantic, recommended by Playwright)
 * - Text content: `getByText()` or `getByRole('heading')` as appropriate
 */
import { test, expect, TEST_USER } from '../fixtures'

// ─── Helper: register + login a user via the browser ───
async function registerAndLogin(page: any, api: any) {
  // Register via API (faster than going through UI)
  await api.post('/auth/register', {
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: TEST_USER.name,
    },
  })

  // Login through browser (sets cookies + in-memory token)
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill(TEST_USER.email)
  await page.locator('#password').fill(TEST_USER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

test.describe('Pricing page (public)', () => {
  test('pricing page loads and shows heading', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible()
    await expect(page.getByText('Choose the plan that works best for you.')).toBeVisible()
  })

  test('shows placeholder when Stripe feature flag is disabled', async ({ page }) => {
    // In the test env, Stripe is disabled by default (FEATURE_STRIPE_ENABLED is not set)
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText('Billing is not available at this time. Check back soon.'),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Billing settings (authenticated)', () => {
  test('billing settings page requires authentication', async ({ page }) => {
    await page.goto('/settings/billing')
    await page.waitForURL('**/auth/login', { timeout: 15_000 })
  })

  test('billing settings shows placeholder when Stripe is disabled', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/settings/billing')
    await page.waitForLoadState('networkidle')

    // When Stripe is disabled, the page shows the "not available" card
    await expect(
      page.getByText('Billing is not available at this time.'),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('settings nav does not show Billing link when Stripe is disabled', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/settings/profile')
    await page.waitForLoadState('networkidle')

    // Profile and Security should be visible in the settings nav
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Security', exact: true })).toBeVisible()

    // Billing should NOT appear in the nav when Stripe is disabled
    await expect(page.getByRole('link', { name: 'Billing', exact: true })).not.toBeVisible()
  })
})

test.describe('Checkout result pages', () => {
  test('checkout success page requires authentication', async ({ page }) => {
    await page.goto('/checkout/success')
    await page.waitForURL('**/auth/login', { timeout: 15_000 })
  })

  test('checkout cancel page requires authentication', async ({ page }) => {
    await page.goto('/checkout/cancel')
    await page.waitForURL('**/auth/login', { timeout: 15_000 })
  })

  test('checkout success page shows confirmation message', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/checkout/success')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible()
    await expect(
      page.getByText('Thank you for your purchase. Your subscription is now active.'),
    ).toBeVisible()

    // Navigation links
    await expect(page.getByRole('link', { name: 'Go to Billing' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Dashboard' })).toBeVisible()
  })

  test('checkout cancel page shows cancellation message', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/checkout/cancel')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Checkout cancelled' })).toBeVisible()
    await expect(
      page.getByText('Your checkout session was cancelled. No charges were made.'),
    ).toBeVisible()

    // Navigation links
    await expect(page.getByRole('link', { name: 'Back to Pricing' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Dashboard' })).toBeVisible()
  })

  test('checkout success → "Go to Billing" navigates to billing settings', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/checkout/success')
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'Go to Billing' }).click()
    await page.waitForURL('**/settings/billing', { timeout: 10_000 })
  })

  test('checkout cancel → "Back to Pricing" navigates to pricing page', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/checkout/cancel')
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'Back to Pricing' }).click()
    await page.waitForURL('**/pricing', { timeout: 10_000 })
  })

  test('checkout success → "Back to Dashboard" navigates to dashboard', async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/checkout/success')
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'Back to Dashboard' }).click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
  })
})

test.describe('Feature flag gating via /config endpoint', () => {
  test('GET /config returns stripe: false when Stripe is disabled', async ({ api }) => {
    const response = await api.get('/config')
    expect(response.ok()).toBeTruthy()

    const { data } = await response.json()
    expect(data.features).toBeDefined()
    expect(data.features.stripe).toBe(false)
  })
})
