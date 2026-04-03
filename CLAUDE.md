# CLAUDE.md — Project Intelligence for Paisa Boilerplate

## What is this?

A production-ready SaaS boilerplate. Fork it, rebrand it, ship it.
Monorepo with NestJS API, Nuxt frontend, shared packages, Prisma ORM.

## Quick Start

```bash
# 1. Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# 2. Install deps + generate Prisma client
pnpm install

# 3. Build workspace packages (config, shared, db)
pnpm build

# 4. Run database migrations
pnpm --filter @paisa/db db:migrate:deploy

# 5. Seed development data
pnpm --filter @paisa/db db:seed

# 6. Start the API
pnpm --filter @paisa/api dev

# 7. Open API docs → http://localhost:3001/api/docs
```

Or use VS Code: press F5 → select "API: Dev Server" (see `.vscode/launch.json`).

## Commands

```bash
# Development
pnpm dev                          # Start all apps (Turborepo, builds deps first)
pnpm build                        # Build all packages + apps
pnpm --filter @paisa/api dev      # Start API only (builds deps first via turbo)
pnpm test                         # Unit tests across all packages
pnpm --filter @paisa/api test     # Unit tests for API only
pnpm --filter @paisa/api test:e2e # E2e tests (needs test DB running)

# Build workspace packages (required before API can start)
pnpm --filter @paisa/config build
pnpm --filter @paisa/shared build
pnpm --filter @paisa/db build

# Database
docker compose -f docker/docker-compose.yml up -d postgres          # Dev DB (port 5432)
docker compose -f docker/docker-compose.yml up -d postgres-test     # Test DB (port 5433)
pnpm --filter @paisa/db db:migrate                                  # Create new migration (interactive)
pnpm --filter @paisa/db db:migrate:deploy                           # Apply migrations (CI/CD)
pnpm --filter @paisa/db db:seed                                     # Seed dev data
pnpm --filter @paisa/db db:studio                                   # Visual data editor (Prisma Studio)
pnpm --filter @paisa/db db:generate                                 # Regenerate client after schema changes

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

### Package builds (tsup)
- `@paisa/config`, `@paisa/shared`, `@paisa/db` compile TS → JS via tsup
- `"main"` in package.json points to `./dist/index.js` (compiled JS)
- `"types"` still points to `./src/index.ts` (raw TS for IDE support)
- Turborepo `dev` task depends on `^build` — packages build before apps start
- After changing package source: run `pnpm build` or let turbo handle it

### Prisma 7 specifics
- No `url` in `schema.prisma` datasource — it's in `prisma.config.ts`
- Generator is `prisma-client` (not `prisma-client-js`)
- Generated client goes to `src/generated/prisma/` (gitignored, regenerate with `npx prisma generate`)
- Runtime: uses `PrismaPg` driver adapter (no Rust engine)
- CLI: reads `DATABASE_URL` from `prisma.config.ts` datasource.url

### Branding
All brand values (name, colors, fonts, social links) live in `packages/config/src/brand.ts`.
API docs title, email templates, and frontend theme all read from this config.

### Environment loading
- `.env` lives at the **monorepo root** (not in individual packages)
- `loadEnvFromRoot()` in `@paisa/config` finds the root by walking up to `turbo.json`
- API uses `loadEnvFromRoot()` in `config.module.ts` (runs after builds)
- `prisma.config.ts` and `seed.ts` have their own inline root-finding (must work before builds)
- `.env.local` overrides `.env` (higher priority, gitignored)

### Environment
- Node 22 (`.nvmrc`)
- pnpm 10.33.0 via corepack
- TypeScript strict mode, ES2023 target
- `LOG_LEVEL=silent` valid (for tests)

### Authentication
- Global JWT guard: ALL routes require auth by default. Use `@Public()` to opt out.
- Password hashing: Argon2id (not bcrypt). The `argon2` package needs native build approval.
- Access tokens: JWT, 15 min, in Authorization header. Contains: sub, email, role.
- Refresh tokens: Random 64-byte string, 7 days, httpOnly cookie. Stored as SHA-256 hash in DB.
- Refresh token rotation: Each use issues a new token and revokes the old one.
- Token families: Track lineage from a single login. Replay detection revokes entire family.
- `@UsePipes()` vs `@Body(pipe)`: Use `@Body(new ZodValidationPipe(schema))` on methods that also have `@CurrentUser()`. `@UsePipes()` applies to ALL params including CurrentUser which breaks validation.
- Email verification/password reset tokens: In-memory Map for now (Phase 8 → Redis).
- `configureApp()` applies Helmet, cookies, CORS, filters, interceptors. Shared by main.ts and tests.
- Domain events: Auth emits events (user.registered, user.logged_in, etc.) via EventBus. Email module will listen in Phase 4.

## Documentation

- `docs/request-lifecycle.md` — Mermaid diagrams showing the full request flow through the API
- `.vscode/launch.json` — One-click run/debug configs for API, tests, Prisma Studio
- `.vscode/extensions.json` — Recommended VS Code extensions

## Gotchas

- **NVM**: Shell must source `~/.nvm/nvm.sh` before running commands
- **Prisma generate**: Must run after `pnpm install` — generated client is gitignored
- **Package builds required**: Workspace packages must be built before the API can start. `pnpm build` or turbo handles it.
- **.env at monorepo root**: The `.env` file lives at the repo root. `loadEnvFromRoot()` finds it by walking up to `turbo.json`.
- **prisma.config.ts must be self-contained**: It runs during `postinstall` before any packages are built, so it cannot import from `@paisa/config`. It has its own inline root-finding logic.
- **Helmet CSP blocks Scalar in dev**: CSP is relaxed in development mode to allow Scalar's CDN scripts. Production uses Helmet's strict defaults.
- **E2e tests need Docker**: `postgres-test` container must be running on port 5433
- **pnpm.onlyBuiltDependencies**: New native packages need explicit approval in root `package.json`
- **`@prisma/adapter-pg`**: Must be a direct dependency of any package that uses PrismaClient
- **argon2 native build**: Must be in `pnpm.onlyBuiltDependencies` in root package.json
- **@Public() on health**: Health endpoint must have `@Public()` since JWT guard is global
- **Passport LocalStrategy**: Uses `usernameField: 'email'` — Passport defaults to 'username'
- **tsup + incremental TS**: tsup DTS generation conflicts with `incremental: true` in tsconfig. Each package has a `tsconfig.build.json` with `incremental: false`.
