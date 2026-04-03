/**
 * # Brand Configuration
 *
 * Central branding config used by both frontend apps and email templates.
 * Change this file to rebrand the entire application.
 *
 * ## How it works
 *
 * 1. This file exports the brand object
 * 2. `tailwind.css` maps `brand.theme` to CSS custom properties
 * 3. shadcn-vue components read CSS variables — no component code changes needed
 * 4. Layout components read `brand.name`, `brand.logo`
 * 5. `<Head>` tags read `brand.name`, `brand.description`, `brand.ogImage`
 * 6. Email templates read `brand.name`, `brand.logo`
 *
 * ## To rebrand
 *
 * Fork the boilerplate, edit this file, replace logo files. Done.
 */

export const brand = {
  // ─── Identity ───
  name: 'Paisa',
  tagline: 'Ship faster, build better',
  description: 'A production-ready boilerplate for modern SaaS applications',

  // ─── Assets (paths relative to public/) ───
  logo: '/logo.svg',
  logoDark: '/logo-dark.svg',
  favicon: '/favicon.ico',
  ogImage: '/og-image.png',

  // ─── Theme — shadcn-vue OKLCH color space ───
  theme: {
    // Primary color drives the entire palette
    primary: 'oklch(0.637 0.237 25.331)',
    primaryForeground: 'oklch(0.971 0.013 17.38)',
    // Customize these to override defaults
    radius: '0.625rem',
  },

  // ─── Typography ───
  fonts: {
    heading: 'Inter',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },

  // ─── Social links ───
  social: {
    twitter: '',
    github: '',
    discord: '',
  },

  // ─── Legal ───
  company: 'My Company LLC',
  termsUrl: '/terms',
  privacyUrl: '/privacy',
} as const;

export type Brand = typeof brand;
