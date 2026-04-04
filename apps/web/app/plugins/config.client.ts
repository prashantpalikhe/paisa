/**
 * # Config Client Plugin
 *
 * Fetches feature flags from the API on app startup.
 *
 * Runs ONLY on the client (`.client.ts` suffix). Calls GET /config
 * to learn which features the backend has enabled (Google OAuth,
 * passkeys, Stripe, etc.) so the frontend can show/hide UI accordingly.
 *
 * Runs in parallel with auth.client.ts — they don't depend on each other.
 */
export default defineNuxtPlugin(async () => {
  const { loadConfig } = useFeatureFlags()
  await loadConfig()
})
