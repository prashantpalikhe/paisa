# CLAUDE.md — Project Intelligence for Paisa Boilerplate

## What is this?

A production-ready SaaS boilerplate. Fork it, rebrand it, ship it.
Monorepo with NestJS API, Nuxt frontend, shared packages, Prisma ORM.

## Commands

```bash
# Development
pnpm dev                          # Start all apps (Turborepo)
pnpm build                        # Build all packages + apps
pnpm test                         # Unit tests across all packages
pnpm --filter @paisa/api test     # Unit tests for API only
pnpm --filter @paisa/api test:e2e # E2e tests (needs test DB running)

# Database
docker compose -f docker/docker-compose.yml up -d postgres          # Dev DB (port 5432)
docker compose -f docker/docker-compose.yml up -d postgres-test     # Test DB (port 5433)
cd packages/db && DATABASE_URL=... npx prisma migrate dev --name xyz  # Create new migration
cd packages/db && npx prisma studio                                   # Visual data editor
cd packages/db && npx prisma generate                                 # Regenerate client after schema changes

# Infrastructure
docker compose -f docker/docker-compose.yml up -d                   # All services
docker compose -f docker/docker-compose.yml down                    # Stop all
```

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces + corepack
- **apps/api**: NestJS 11 (REST, SWC compiler)
- **apps/web**: Nuxt 4 (planned)
- **apps/admin**: Nuxt 4 (planned)
- **packages/config**: Zod-validated env vars + feature flags + brand config
- **packages/db**: Prisma 7 + PostgreSQL 17
- **packages/shared**: Types, validators, constants shared between frontend/backend

## Key Conventions

### Feature flags — two tiers
- **Infrastructure flags**: Env vars (`FEATURE_*`), read at startup, require redeploy
- **Business flags**: Stored in DB (`FeatureFlag` table), togglable at runtime via admin

### Architectural invariant
Core modules (Config, Database, Auth) NEVER import optional modules (Stripe, Email, Redis).
Communication between them happens via EventBus only.

### App configuration — single source of truth
`src/configure-app.ts` is shared between `main.ts` and e2e tests.
NEVER add middleware directly in `main.ts` — add it to `configureApp()`.

### API response shape
- Success: `{ data: T }`
- Error: `{ error: { code: string, message: string, details?: [] } }`
- Exception: `/health` returns raw (not wrapped)

### Testing
- Unit tests: `src/**/*.spec.ts`, mocked dependencies, fast
- E2e tests: `test/e2e/**/*.spec.ts`, real DB on port 5433, sequential
- Factories in `test/factories/` — use these, don't write raw `prisma.create()`
- Every e2e test file: `beforeEach(() => resetDatabase(prisma))`

### Prisma 7 specifics
- No `url` in `schema.prisma` datasource — it's in `prisma.config.ts`
- Generator is `prisma-client` (not `prisma-client-js`)
- Generated client goes to `src/generated/prisma/` (gitignored, regenerate with `npx prisma generate`)
- Runtime: uses `PrismaPg` driver adapter (no Rust engine)
- CLI: reads `DATABASE_URL` from `prisma.config.ts` datasource.url

### Branding
All brand values (name, colors, fonts, social links) live in `packages/config/src/brand.ts`.
API docs title, email templates, and frontend theme all read from this config.

### Environment
- Node 22 (`.nvmrc`)
- pnpm 10.33.0 via corepack
- TypeScript strict mode, ES2023 target
- `LOG_LEVEL=silent` valid (for tests)

## Gotchas

- **NVM**: Shell must source `~/.nvm/nvm.sh` before running commands
- **Prisma generate**: Must run after `pnpm install` — generated client is gitignored
- **E2e tests need Docker**: `postgres-test` container must be running on port 5433
- **pnpm.onlyBuiltDependencies**: New native packages need explicit approval in root `package.json`
- **`@prisma/adapter-pg`**: Must be a direct dependency of any package that uses PrismaClient
