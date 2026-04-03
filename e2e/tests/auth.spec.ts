/**
 * # Auth E2E Tests
 *
 * Full user-flow tests in a real browser against real API + real database.
 *
 * ## Selector strategy
 *
 * - Form inputs: `page.locator('#id')` (reliable with shadcn-vue)
 * - Headings/buttons: `getByRole()` (semantic, recommended by Playwright)
 * - Text content: `getByRole('heading')` over `getByText()` to avoid
 *   matching Nuxt's `<span role="status">` page title element
 *
 * ## Database strategy
 *
 * The `resetDb` auto-fixture truncates all tables before each test.
 */
import { test, expect, TEST_USER } from '../fixtures'

// ─── Helper: wait for emails to arrive (event processing is async) ───
async function waitForEmails(api: any, minCount = 1, timeoutMs = 5000): Promise<any[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const response = await api.get('/test/emails')
    const { data } = await response.json()
    if (data.emails.length >= minCount) return data.emails
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`Expected at least ${minCount} emails within ${timeoutMs}ms`)
}

test.describe('Registration', () => {
  test('register with valid credentials → lands on dashboard', async ({ page }) => {
    await page.goto('/auth/register')
    await page.waitForLoadState('networkidle')

    await page.locator('#name').fill(TEST_USER.name)
    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(TEST_USER.password)

    await page.getByRole('button', { name: 'Create account' }).click()

    await page.waitForURL('**/dashboard', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('register shows validation errors for invalid input', async ({ page }) => {
    await page.goto('/auth/register')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill('not-an-email')
    await page.locator('#password').fill('weak')

    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Invalid email address')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
  })
})

test.describe('Login', () => {
  test.beforeEach(async ({ api }) => {
    await api.post('/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })
  })

  test('login with valid credentials → lands on dashboard', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(TEST_USER.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('**/dashboard', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('login with wrong password → shows error message', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill('WrongPassword1')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('login shows validation errors for empty fields', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email address')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Password is required')).toBeVisible()
  })
})

test.describe('Logout', () => {
  test('logout → redirected to login page', async ({ page, api }) => {
    await api.post('/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })

    // Login through the UI
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(TEST_USER.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    // Open user dropdown and click logout
    await page.getByRole('button', { name: new RegExp(TEST_USER.name) }).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()

    await page.waitForURL('**/auth/login', { timeout: 10_000 })
  })
})

test.describe('Route protection', () => {
  test('visiting /dashboard without auth → redirected to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/auth/login', { timeout: 15_000 })
  })
})

test.describe('Forgot password → Reset password', () => {
  test('full password reset flow via email', async ({ page, api }) => {
    // 1. Register a user
    await api.post('/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })
    await api.delete('/test/emails')

    // 2. Request password reset
    await page.goto('/auth/forgot-password')
    await page.waitForLoadState('networkidle')
    await page.locator('#email').fill(TEST_USER.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10_000 })

    // 3. Get the reset token from captured email (wait for async event)
    const emails = await waitForEmails(api, 1)
    const resetEmail = emails.find((e: any) =>
      e.subject.toLowerCase().includes('reset') || e.subject.toLowerCase().includes('password'),
    )
    expect(resetEmail).toBeDefined()

    const tokenMatch = resetEmail.html.match(/reset-password\?token=([a-zA-Z0-9_-]+)/)
    expect(tokenMatch).toBeTruthy()
    const resetToken = tokenMatch![1]

    // 4. Reset the password
    await page.goto(`/auth/reset-password?token=${resetToken}`)
    await page.waitForLoadState('networkidle')

    const newPassword = 'NewPassword456'
    await page.locator('#password').fill(newPassword)
    await page.getByRole('button', { name: 'Reset password' }).click()

    await expect(page.getByText('Password updated')).toBeVisible({ timeout: 10_000 })

    // 5. Login with the new password
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await page.waitForURL('**/auth/login')
    await page.waitForLoadState('networkidle')

    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(newPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('**/dashboard', { timeout: 15_000 })
  })
})

test.describe('Email verification', () => {
  test('register → verification email → verify email', async ({ page, api }) => {
    // 1. Register through the UI
    await page.goto('/auth/register')
    await page.waitForLoadState('networkidle')
    await page.locator('#name').fill(TEST_USER.name)
    await page.locator('#email').fill(TEST_USER.email)
    await page.locator('#password').fill(TEST_USER.password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    // 2. Wait for verification email (async event processing)
    const emails = await waitForEmails(api, 1)

    // Find the verification email (could be "verify" or "welcome")
    const verifyEmail = emails.find((e: any) =>
      e.to === TEST_USER.email &&
      (e.subject.toLowerCase().includes('verify') || e.subject.toLowerCase().includes('welcome')),
    )
    expect(verifyEmail).toBeDefined()

    // Extract verification token
    const tokenMatch = verifyEmail.html.match(/verify-email\?token=([a-zA-Z0-9_-]+)/)
    expect(tokenMatch).toBeTruthy()
    const verifyToken = tokenMatch![1]

    // 3. Visit the verification link
    await page.goto(`/auth/verify-email?token=${verifyToken}`)

    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Landing page', () => {
  test('landing page renders and links work', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Hero heading
    await expect(page.getByRole('heading', { name: 'Ship faster, build better' })).toBeVisible()

    // Navigation links
    await expect(page.getByRole('link', { name: 'Get started' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()

    // Click "Sign in" → goes to login
    await page.getByRole('link', { name: 'Sign in' }).first().click()
    await page.waitForURL('**/auth/login')
  })
})
