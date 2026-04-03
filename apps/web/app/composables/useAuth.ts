/**
 * # Auth Composable
 *
 * Central auth state management for the entire app.
 *
 * ## Token strategy (important — read this)
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────┐
 * │              Token Storage Strategy                           │
 * │                                                              │
 * │  Access Token                 Refresh Token                   │
 * │  ├── WHERE: JavaScript var    ├── WHERE: httpOnly cookie      │
 * │  ├── LIFETIME: 15 min         ├── LIFETIME: 7 days            │
 * │  ├── SENT: Authorization      ├── SENT: automatically by      │
 * │  │   header (manually)        │   browser (credentials:       │
 * │  │                            │   'include')                  │
 * │  ├── XSS safe? YES            ├── XSS safe? YES (httpOnly)   │
 * │  │   (not in storage)         │   (JS can't read it)          │
 * │  └── Survives refresh? NO     └── Survives refresh? YES       │
 * │      (call /auth/refresh         (cookie persists)            │
 * │       on page load)                                           │
 * └──────────────────────────────────────────────────────────────┘
 * ```
 *
 * On page reload, the access token is LOST (it's just a variable).
 * The `auth.client.ts` plugin calls `refresh()` on startup, which
 * uses the httpOnly cookie to get a fresh access token.
 *
 * ## Why not localStorage?
 *
 * Any XSS vulnerability can read localStorage. An attacker could steal
 * the token and impersonate the user from a different machine.
 * With memory-only storage, the token dies when the tab closes.
 *
 * ## Why not Pinia?
 *
 * Pinia is great, but adds a dependency for something simple.
 * Nuxt's `useState` handles reactive user state. The access token
 * isn't reactive (nothing renders based on its value) — it's just
 * a string read by the API client.
 */
import type { AuthUser } from '@paisa/shared'

// ─── Module-scope variables (client-side memory only) ───
// These are NOT reactive and NOT serialized to SSR payload.
// They exist only in the browser's JavaScript runtime.
let accessToken: string | null = null
let accessTokenExpiresAt: number | null = null
let refreshPromise: Promise<boolean> | null = null

export function useAuth() {
  // Reactive state — survives SSR hydration via useState
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isLoading = useState<boolean>('auth-loading', () => true)

  const isAuthenticated = computed(() => !!user.value)

  // ─── Token management ───

  /**
   * Store the access token in memory.
   * Subtracts 30 seconds from expiry as a buffer — we refresh BEFORE
   * the token actually expires, so API calls never fail due to expiry.
   */
  function setTokens(token: string, expiresIn: number) {
    accessToken = token
    // expiresIn is in seconds. Buffer: refresh 30s before actual expiry.
    accessTokenExpiresAt = Date.now() + (expiresIn * 1000) - 30_000
  }

  /**
   * Get a valid access token, refreshing if needed.
   * Returns null if the user is not authenticated.
   */
  async function getAccessToken(): Promise<string | null> {
    // Token exists and hasn't expired? Use it.
    if (accessToken && accessTokenExpiresAt && Date.now() < accessTokenExpiresAt) {
      return accessToken
    }

    // Token expired or missing — try to refresh
    const success = await refresh()
    return success ? accessToken : null
  }

  /** Clear all auth state (used on logout and auth failure) */
  function clearAuth() {
    accessToken = null
    accessTokenExpiresAt = null
    user.value = null
  }

  // ─── API helpers ───

  const config = useRuntimeConfig()
  const apiBase = config.public.apiBaseUrl as string

  /** Make an API call with credentials (sends httpOnly cookie) */
  async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await $fetch<{ data: T }>(url, {
      baseURL: apiBase,
      credentials: 'include',
      ...options,
      headers: {
        ...options.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    } as any)

    // The API wraps all responses in { data: T }
    return (response as any)?.data ?? response as T
  }

  // ─── Auth actions ───

  /**
   * Register a new account.
   * On success: stores tokens, sets user, navigates to dashboard.
   */
  async function register(email: string, password: string, name?: string) {
    const result = await apiFetch<{
      accessToken: string
      expiresIn: number
      user: AuthUser
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
      headers: { 'Content-Type': 'application/json' },
    })

    setTokens(result.accessToken, result.expiresIn)
    user.value = result.user
    await navigateTo('/dashboard')
  }

  /**
   * Login with email and password.
   * On success: stores tokens, sets user, navigates to dashboard.
   */
  async function login(email: string, password: string) {
    const result = await apiFetch<{
      accessToken: string
      expiresIn: number
      user: AuthUser
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    })

    setTokens(result.accessToken, result.expiresIn)
    user.value = result.user
    await navigateTo('/dashboard')
  }

  /**
   * Refresh the access token using the httpOnly cookie.
   * The browser sends the cookie automatically — no JS needed.
   *
   * Deduplicates concurrent calls: if a refresh is already in progress,
   * subsequent calls wait for the same promise.
   */
  async function refresh(): Promise<boolean> {
    // Deduplicate: if already refreshing, wait for that result
    if (refreshPromise) return refreshPromise

    refreshPromise = (async () => {
      try {
        const result = await $fetch<{ data: { accessToken: string; expiresIn: number } }>('/auth/refresh', {
          baseURL: apiBase,
          method: 'POST',
          credentials: 'include', // Sends the httpOnly cookie
        })

        const data = (result as any)?.data ?? result
        setTokens(data.accessToken, data.expiresIn)
        return true
      } catch {
        // Refresh failed — user needs to log in again
        clearAuth()
        return false
      } finally {
        refreshPromise = null
      }
    })()

    return refreshPromise
  }

  /**
   * Fetch the current user's profile.
   * Called after successful refresh to populate user state.
   */
  async function fetchUser(): Promise<void> {
    try {
      const me = await apiFetch<AuthUser>('/auth/me')
      user.value = me
    } catch {
      clearAuth()
    }
  }

  /**
   * Logout — revoke the refresh token, clear the cookie, clear state.
   */
  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Even if the API call fails, clear local state
    }
    clearAuth()
    await navigateTo('/auth/login')
  }

  /**
   * Initialize auth on client startup.
   * Called by the auth.client.ts plugin.
   * Attempts silent refresh using the httpOnly cookie.
   */
  async function initAuth() {
    isLoading.value = true
    try {
      const success = await refresh()
      if (success) {
        await fetchUser()
      }
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    user,
    isAuthenticated,
    isLoading,

    // Actions
    login,
    register,
    logout,
    refresh,
    fetchUser,
    initAuth,
    getAccessToken,
    setTokens,
    clearAuth,
  }
}
