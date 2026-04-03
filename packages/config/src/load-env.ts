/**
 * # Monorepo-Aware Environment Loader
 *
 * Finds the workspace root by walking up directories looking for `turbo.json`,
 * then loads `.env.local` and `.env` from there.
 *
 * ## Why this exists
 *
 * In a monorepo, scripts run from different directories:
 * - `apps/api/` (NestJS dev server)
 * - `packages/db/` (Prisma CLI, seed scripts)
 * - `/` (Turborepo root)
 *
 * Each needs to find the `.env` file at the monorepo root. Without a shared
 * utility, every script independently hardcodes `../../.env` with a different
 * number of `../` — fragile and error-prone.
 *
 * ## Usage
 *
 * ```typescript
 * import { loadEnvFromRoot } from '@paisa/config';
 * loadEnvFromRoot(); // Finds monorepo root, loads .env.local + .env
 * ```
 *
 * ## Load order
 *
 * 1. `.env.local` (highest priority — personal overrides, gitignored)
 * 2. `.env` (shared defaults, gitignored)
 *
 * Variables already set in `process.env` are NOT overwritten (dotenv default).
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Walk up from `startDir` looking for a file named `marker`.
 * Returns the directory containing the marker, or null if not found.
 */
function findWorkspaceRoot(startDir: string, marker = 'turbo.json'): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, marker))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Load `.env.local` and `.env` from the monorepo root.
 *
 * @param startDir - Directory to start searching from (defaults to `process.cwd()`)
 * @returns The resolved monorepo root path, or null if not found
 */
export function loadEnvFromRoot(startDir?: string): string | null {
  const root = findWorkspaceRoot(startDir ?? process.cwd());

  if (!root) {
    // Not fatal — CI environments set env vars directly, no .env file needed.
    return null;
  }

  // Load .env.local first (higher priority), then .env.
  // dotenv does NOT overwrite existing values, so .env.local wins.
  dotenv.config({ path: path.join(root, '.env.local') });
  dotenv.config({ path: path.join(root, '.env') });

  return root;
}
