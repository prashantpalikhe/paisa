/**
 * # tsup Build Config — @paisa/shared
 *
 * Compiles shared types, constants, and Zod validators to JavaScript.
 * Consumed by both the NestJS API and the Nuxt frontend.
 *
 * Why CJS?
 * - NestJS uses CommonJS (`module: "commonjs"` in tsconfig)
 * - Nuxt can import CJS packages fine
 * - One format = simpler setup
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  tsconfig: 'tsconfig.build.json',
  // Don't bundle zod — it must be shared across all packages so that
  // `instanceof ZodError` works consistently. If tsup bundles its own
  // copy of zod, the ZodError class identity differs from the API's copy
  // and instanceof checks fail (errors become 500 instead of 400).
  external: ['zod'],
});
