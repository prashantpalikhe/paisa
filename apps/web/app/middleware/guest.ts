/**
 * # Guest Middleware
 *
 * Protects routes that should ONLY be accessible to unauthenticated users.
 * Used on login, register, forgot-password pages.
 *
 * ## How to use
 *
 * ```ts
 * definePageMeta({ middleware: 'guest' })
 * ```
 *
 * ## How it works
 *
 * If the user IS authenticated → redirect to /dashboard.
 * This prevents a logged-in user from seeing the login form.
 */
export default defineNuxtRouteMiddleware(async () => {
  // Only run on the client — SSR doesn't have auth state
  if (import.meta.server) return

  const { isAuthenticated, isLoading } = useAuth()

  // Wait for auth to resolve (same pattern as auth middleware)
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

  // Already logged in? Go to dashboard.
  if (isAuthenticated.value) {
    return navigateTo('/dashboard')
  }
})
