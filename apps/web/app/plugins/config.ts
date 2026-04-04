/**
 * # Config Plugin
 *
 * Fetches feature flags from the API on app startup.
 *
 * Calls GET /config to learn which features the backend has enabled
 * (Google OAuth, passkeys, Stripe, etc.) so the frontend can
 * show/hide UI accordingly.
 *
 * Runs in parallel with auth.ts — they don't depend on each other.
 */
export default defineNuxtPlugin(async () => {
  const { loadConfig } = useFeatureFlags()
  await loadConfig()
})
