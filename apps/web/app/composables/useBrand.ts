import { brand } from '@paisa/config'

/**
 * Provides access to brand configuration from `packages/config/src/brand.ts`.
 *
 * All user-facing brand text (app name, tagline, company name, links)
 * comes from this single source. To rebrand: edit brand.ts, done.
 */
export function useBrand() {
  return brand
}
