/**
 * # Profile E2E Tests
 *
 * Tests for the profile settings page:
 * - Update name
 * - Avatar upload (with instant preview)
 * - Avatar removal
 * - Avatar validation (file size, file type)
 *
 * ## Test strategy
 *
 * Each test registers a user via API, logs in through the browser,
 * then exercises the profile page. The `resetDb` auto-fixture
 * ensures a clean slate before each test.
 */
import path from 'node:path'
import { test, expect, TEST_USER } from '../fixtures'

const TEST_AVATAR_PATH = path.resolve(__dirname, '../fixtures/files/test-avatar.png')

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

test.describe('Profile settings', () => {
  test.beforeEach(async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/settings/profile')
    await page.waitForLoadState('networkidle')
  })

  test('profile page shows user info', async ({ page }) => {
    // Name field should be pre-filled
    await expect(page.locator('#name')).toHaveValue(TEST_USER.name)

    // Email field should be disabled and show the email
    const emailInput = page.locator('#email')
    await expect(emailInput).toHaveValue(TEST_USER.email)
    await expect(emailInput).toBeDisabled()
  })

  test('update name', async ({ page }) => {
    await page.locator('#name').clear()
    await page.locator('#name').fill('New Name')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Profile updated successfully')).toBeVisible({ timeout: 10_000 })

    // Verify the header dropdown also reflects the new name
    await expect(page.getByRole('button', { name: /New Name/ })).toBeVisible()
  })
})

test.describe('Avatar upload', () => {
  test.beforeEach(async ({ page, api }) => {
    await registerAndLogin(page, api)
    await page.goto('/settings/profile')
    await page.waitForLoadState('networkidle')
  })

  test('upload avatar → shows image, persists after reload', async ({ page }) => {
    // Initially, no avatar image — should show initials fallback
    const avatarImg = page.locator('form img[alt]').first()
    await expect(avatarImg).not.toBeVisible()

    // Upload a file by setting it on the hidden file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_AVATAR_PATH)

    // After upload, the avatar image should be visible
    // (first as instant preview, then as real URL from server)
    await expect(page.locator('form img[alt]').first()).toBeVisible({ timeout: 10_000 })

    // The "Remove photo" link should appear
    await expect(page.getByText('Remove photo')).toBeVisible()

    // Reload the page — avatar should persist (came from the database)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('form img[alt]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('upload avatar → header dropdown shows avatar', async ({ page }) => {
    // Upload avatar
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_AVATAR_PATH)

    // Wait for the upload to complete (Remove photo appears)
    await expect(page.getByText('Remove photo')).toBeVisible({ timeout: 10_000 })

    // The header dropdown trigger should now show an avatar image
    const headerAvatar = page.locator('header img[alt]').first()
    await expect(headerAvatar).toBeVisible()
  })

  test('remove avatar → image disappears', async ({ page }) => {
    // First upload an avatar
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_AVATAR_PATH)
    await expect(page.getByText('Remove photo')).toBeVisible({ timeout: 10_000 })

    // Now remove it
    await page.getByText('Remove photo').click()

    // Wait for removal to complete — "Remove photo" should disappear
    await expect(page.getByText('Remove photo')).not.toBeVisible({ timeout: 10_000 })

    // Avatar image should no longer be in the form
    await expect(page.locator('form img[alt]').first()).not.toBeVisible()

    // Verify persists after reload
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Remove photo')).not.toBeVisible({ timeout: 5_000 })
  })

  test('upload replaces existing avatar', async ({ page }) => {
    // Upload first avatar
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_AVATAR_PATH)
    await expect(page.getByText('Remove photo')).toBeVisible({ timeout: 10_000 })

    // Get the first avatar's src
    const firstSrc = await page.locator('form img[alt]').first().getAttribute('src')

    // Upload again — should replace
    await fileInput.setInputFiles(TEST_AVATAR_PATH)
    await expect(page.getByText('Remove photo')).toBeVisible({ timeout: 10_000 })

    // The src should be different (different UUID filename)
    const secondSrc = await page.locator('form img[alt]').first().getAttribute('src')
    expect(secondSrc).not.toBe(firstSrc)
  })
})

test.describe('Avatar upload via API', () => {
  test('upload and remove avatar via direct API calls', async ({ api }) => {
    // Register user
    const registerRes = await api.post('/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })
    const { data: registerData } = await registerRes.json()
    const token = registerData.accessToken

    // Verify user initially has no avatar
    const meRes = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const { data: me } = await meRes.json()
    expect(me.avatarUrl).toBeNull()

    // Upload avatar via multipart
    const uploadRes = await api.post('/users/me/avatar', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'test-avatar.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            // Minimal valid 1x1 PNG
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            'base64',
          ),
        },
      },
    })
    expect(uploadRes.ok()).toBeTruthy()

    const { data: uploaded } = await uploadRes.json()
    expect(uploaded.avatarUrl).toBeTruthy()
    expect(uploaded.avatarUrl).toContain('/uploads/avatars/')

    // Verify the avatar URL is accessible
    const avatarRes = await api.get(uploaded.avatarUrl)
    expect(avatarRes.ok()).toBeTruthy()

    // Remove avatar
    const removeRes = await api.delete('/users/me/avatar', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(removeRes.ok()).toBeTruthy()

    const { data: removed } = await removeRes.json()
    expect(removed.avatarUrl).toBeNull()
  })

  test('upload rejects files that are too large', async ({ api }) => {
    // Register user
    const registerRes = await api.post('/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })
    const { data: registerData } = await registerRes.json()
    const token = registerData.accessToken

    // Create a buffer larger than 2MB
    const largeBuffer = Buffer.alloc(3 * 1024 * 1024, 0) // 3MB of zeros

    const uploadRes = await api.post('/users/me/avatar', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'large-file.png',
          mimeType: 'image/png',
          buffer: largeBuffer,
        },
      },
    })
    expect(uploadRes.ok()).toBeFalsy()
    expect(uploadRes.status()).toBe(400)
  })

  test('upload rejects non-image files', async ({ api }) => {
    // Register user
    const registerRes = await api.post('/auth/register', {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        name: TEST_USER.name,
      },
    })
    const { data: registerData } = await registerRes.json()
    const token = registerData.accessToken

    const uploadRes = await api.post('/users/me/avatar', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content'),
        },
      },
    })
    expect(uploadRes.ok()).toBeFalsy()
    expect(uploadRes.status()).toBe(400)
  })

  test('upload requires authentication', async ({ api }) => {
    const uploadRes = await api.post('/users/me/avatar', {
      multipart: {
        file: {
          name: 'test-avatar.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake'),
        },
      },
    })
    expect(uploadRes.ok()).toBeFalsy()
    expect(uploadRes.status()).toBe(401)
  })
})
