/**
 * # tsup Build Config — @paisa/shared
 *
 * Compiles shared types, constants, and Zod validators to JavaScript.
 * Consumed by both the NestJS API and the Nuxt frontend.
 *
 * Dual format (CJS + ESM):
 * - NestJS uses CommonJS (`module: "commonjs"` in tsconfig) → reads dist/index.js
 * - Nuxt 4 / Vite requires ESM with named exports → reads dist/index.mjs
 * - package.json "exports" field controls which format each consumer gets
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
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
