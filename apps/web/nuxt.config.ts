/**
 * # Nuxt Configuration
 *
 * ## Key decisions
 *
 * - Nuxt 4 — uses `app/` directory structure natively
 * - `shadcn-nuxt` — auto-imports shadcn-vue components from `app/components/ui`
 * - `@tailwindcss/vite` — Tailwind CSS v4 uses a Vite plugin (not PostCSS)
 * - `runtimeConfig.public.apiBaseUrl` — overridden by NUXT_PUBLIC_API_BASE_URL env var
 * - `ssr: true` — SSR is on, but auth state is client-side only.
 *   Protected pages render a loading state until the client hydrates.
 *
 * ## Why not @nuxtjs/tailwindcss?
 *
 * Tailwind CSS v4 replaces the PostCSS-based approach with a Vite plugin.
 * The `@nuxtjs/tailwindcss` module is for Tailwind v3. With v4, we register
 * `@tailwindcss/vite` directly in the Vite plugins array.
 */
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-04-03',

  // ─── Modules ───
  modules: ['shadcn-nuxt'],

  // ─── shadcn-vue config ───
  shadcn: {
    /**
     * Prefix for shadcn components (empty = no prefix).
     * With prefix 'Ui', components become <UiButton>, <UiCard>, etc.
     * Empty string means <Button>, <Card> — cleaner templates.
     */
    prefix: '',
    /**
     * Directory where `shadcn-vue add` installs component files.
     * shadcn-nuxt auto-imports from this directory.
     */
    componentDir: './app/components/ui',
  },

  // ─── CSS ───
  css: ['~/assets/css/tailwind.css'],

  // ─── Vite plugins + optimization ───
  vite: {
    plugins: [
      tailwindcss(),
    ],
    // Pre-bundle heavy deps to avoid page reloads during dev
    optimizeDeps: {
      include: [
        'class-variance-authority',
        'reka-ui',
        'clsx',
        'tailwind-merge',
      ],
    },
  },

  // ─── Runtime config (available at runtime, overridden by env vars) ───
  runtimeConfig: {
    public: {
      // NUXT_PUBLIC_API_BASE_URL overrides this at runtime
      apiBaseUrl: 'http://localhost:3001',
    },
  },

  // ─── Dev server ───
  devServer: {
    port: 3000,
  },

  // ─── TypeScript ───
  typescript: {
    strict: true,
  },

  // ─── Dev tools ───
  devtools: { enabled: true },
})
