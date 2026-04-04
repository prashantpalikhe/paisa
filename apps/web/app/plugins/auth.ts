/**
 * # Auth Plugin
 *
 * Restores the user's session on app startup.
 *
 * On every page load / browser refresh, tries to restore the session
 * using the httpOnly refresh token cookie:
 *
 * 1. Browser loads the SPA
 * 2. This plugin runs → calls `initAuth()`
 * 3. `initAuth()` sends POST /auth/refresh with `credentials: 'include'`
 * 4. If the cookie is valid → new access token stored in memory, user fetched
 * 5. If the cookie is missing/expired → user stays logged out (isLoading → false)
 *
 * Runs once during app initialization, before any page renders.
 * This guarantees auth state is ready before middleware/pages check it.
 */
export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()

  // Restore session from httpOnly cookie.
  // This is fire-and-forget from the plugin's perspective —
  // initAuth() sets isLoading = false when done, which unblocks
  // pages that show a loading state while auth is resolving.
  await initAuth()
})
