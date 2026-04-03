/**
 * # tsup Build Config — @paisa/config
 *
 * Compiles TypeScript to JavaScript so NestJS (and other consumers)
 * can `require('@paisa/config')` without needing a TS loader at runtime.
 *
 * Why tsup?
 * - Zero-config for simple packages
 * - Fast (uses esbuild under the hood)
 * - Produces both CJS for NestJS and keeps types for IDE support
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  tsconfig: 'tsconfig.build.json',
  // Don't bundle zod — keep a single shared copy across the monorepo.
  // See @paisa/shared tsup.config.ts for the full explanation.
  external: ['zod', 'dotenv'],
});
