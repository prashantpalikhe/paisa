/**
 * # Feature Flags Composable
 *
 * Fetches feature flags from the API's public config endpoint.
 *
 * Named `useFeatureFlags` (not `useAppConfig`) because Nuxt has a
 * built-in `useAppConfig` composable — shadowing it causes warnings.
 *
 * ## Why fetch from the API?
 *
 * Feature flags are set via backend env vars (FEATURE_*). The frontend
 * can't read those directly, and backend/frontend deploy independently.
 * So the frontend asks the API "what features are enabled?" on startup.
 *
 * ## Caching
 *
 * GET /config is called ONCE on app load. The result is stored in a
 * shared reactive state (via useState) so all components can read it
 * without re-fetching. The flags don't change at runtime — they're
 * set by env vars and require a backend redeploy to change.
 *
 * ## Usage
 *
 * ```vue
 * <script setup>
 * const { appConfig } = useFeatureFlags()
 * </script>
 *
 * <template>
 *   <Button v-if="appConfig.auth.google" @click="loginWithGoogle">
 *     Continue with Google
 *   </Button>
 * </template>
 * ```
 */

/** Shape of the response from GET /config */
interface AppConfig {
  auth: {
    google: boolean
    passkey: boolean
    twoFactor: boolean
  }
  features: {
    stripe: boolean
  }
}

const DEFAULT_CONFIG: AppConfig = {
  auth: {
    google: false,
    passkey: false,
    twoFactor: false,
  },
  features: {
    stripe: false,
  },
}

export function useFeatureFlags() {
  // useState is Nuxt's SSR-safe shared state — like a global reactive ref
  // that survives across components. The key ensures all components share
  // the same instance.
  const appConfig = useState<AppConfig>('appConfig', () => DEFAULT_CONFIG)
  const isLoaded = useState<boolean>('appConfigLoaded', () => false)

  const runtimeConfig = useRuntimeConfig()
  const apiBase = runtimeConfig.public.apiBaseUrl as string

  /**
   * Fetch config from the API. Called once by a Nuxt plugin on app load.
   * Safe to call multiple times — skips if already loaded.
   */
  async function loadConfig(): Promise<void> {
    if (isLoaded.value) return

    try {
      // The /config endpoint is public and returns the ResponseTransformInterceptor
      // wrapper: { data: { auth: {...}, features: {...} } }
      const response = await $fetch<{ data: AppConfig }>('/config', { baseURL: apiBase })
      appConfig.value = response.data
    } catch {
      // If the API is unreachable, keep defaults (everything disabled).
      // The app will still work — OAuth buttons just won't show.
    }

    isLoaded.value = true
  }

  return {
    appConfig: readonly(appConfig),
    isLoaded: readonly(isLoaded),
    loadConfig,
  }
}
