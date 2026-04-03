/**
 * # Prisma 7 Configuration
 *
 * In Prisma 7, the database connection URL moved from `schema.prisma`
 * to this config file. All CLI commands (migrate, generate, studio, seed)
 * read the connection URL from here.
 *
 * ## Environment variables
 *
 * - `DATABASE_URL` — PostgreSQL connection string (required)
 *
 * ## Usage
 *
 * This file is auto-detected by Prisma CLI when running commands
 * from the `packages/db/` directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env from the monorepo root.
//
// Why not use `loadEnvFromRoot()` from @paisa/config?
// Because prisma.config.ts runs during `postinstall` (via `prisma generate`),
// BEFORE any workspace packages are built. At that point, @paisa/config/dist
// doesn't exist yet. So this file must be self-contained.
//
// This is the ONE place where inline dotenv loading is acceptable.
// All other scripts should use `loadEnvFromRoot()` from @paisa/config.
function findRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'turbo.json'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

const root = findRoot(__dirname);
if (root) {
  dotenv.config({ path: path.join(root, '.env.local') });
  dotenv.config({ path: path.join(root, '.env') });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Ensure .env exists at the monorepo root ' +
    'with DATABASE_URL=postgresql://user:pass@localhost:5432/dbname',
  );
}

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  migrate: {
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  },

  // Prisma 7 requires the URL here for CLI commands (migrate, studio, seed).
  // At runtime, the URL is passed via PrismaPg adapter instead.
  datasource: {
    url: databaseUrl,
  },
});
