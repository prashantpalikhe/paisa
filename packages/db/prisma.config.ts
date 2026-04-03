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
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  migrate: {
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  },
});
