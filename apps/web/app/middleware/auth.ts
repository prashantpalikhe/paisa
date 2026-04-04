/**
 * # Auth Middleware
 *
 * Protects routes that require authentication.
 *
 * ## How to use
 *
 * In any page component:
 * ```ts
 * definePageMeta({ middleware: 'auth' })
 * ```
 *
 * ## How it works
 *
 * 1. Waits for the auth plugin to finish loading (isLoading → false)
 * 2. If the user is NOT authenticated → redirect to /auth/login
 * 3. If authenticated → allow navigation
 *
 * ## Why wait for isLoading?
 *
 * On page refresh, the auth plugin is restoring the session from the
 * httpOnly cookie. During that time, `isAuthenticated` is false even if
 * the user has a valid session. Without waiting, we'd incorrectly
 * redirect logged-in users to the login page on every refresh.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, isLoading } = useAuth()

  // Wait for the auth plugin to finish restoring the session.
  // This happens on page refresh when initAuth() is still in-flight.
  if (isLoading.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(isLoading, (loading) => {
        if (!loading) {
          stop()
          resolve()
        }
      }, { immediate: true })
    })
  }

  // Not authenticated? Send to login.
  if (!isAuthenticated.value) {
    return navigateTo('/auth/login')
  }
})
