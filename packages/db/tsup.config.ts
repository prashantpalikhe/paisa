/**
 * # tsup Build Config — @paisa/db
 *
 * Compiles the database package entry point to JavaScript.
 * Re-exports PrismaClient, model types, enums, and the PrismaPg adapter.
 *
 * Note: The Prisma 7 generated client lives in `src/generated/prisma/`.
 * tsup bundles the re-exports from `src/index.ts`, pulling in the
 * generated code automatically.
 *
 * ## Build order
 *
 * 1. `prisma generate` → creates `src/generated/prisma/` (runs on postinstall)
 * 2. `tsup` → compiles `src/index.ts` → `dist/index.js`
 *
 * Turborepo handles this via `"build": { "dependsOn": ["^build"] }`.
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  tsconfig: 'tsconfig.build.json',
  // Don't bundle these — they're node_modules that should be required at runtime
  external: ['@prisma/client', '@prisma/adapter-pg'],
});
