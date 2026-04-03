/**
 * # Auth Client Plugin
 *
 * Runs ONLY on the client (`.client.ts` suffix = Nuxt skips it during SSR).
 *
 * ## What it does
 *
 * On every page load / browser refresh, it tries to restore the user's session
 * using the httpOnly refresh token cookie. The flow:
 *
 * 1. Browser loads the page → Nuxt hydrates
 * 2. This plugin runs → calls `initAuth()`
 * 3. `initAuth()` sends POST /auth/refresh with `credentials: 'include'`
 * 4. If the cookie is valid → new access token stored in memory, user fetched
 * 5. If the cookie is missing/expired → user stays logged out (isLoading → false)
 *
 * ## Why a plugin?
 *
 * Plugins run once during app initialization, before any page renders.
 * This guarantees auth state is ready before middleware/pages check it.
 * Without this, protected pages would flash the login screen on refresh.
 */
export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()

  // Restore session from httpOnly cookie.
  // This is fire-and-forget from the plugin's perspective —
  // initAuth() sets isLoading = false when done, which unblocks
  // pages that show a loading state while auth is resolving.
  await initAuth()
})
