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
pnpm --filter @paisa/api test:e2e # API e2e tests (needs test DB running)
pnpm test:e2e:web                 # Frontend Playwright e2e tests (needs test DB + both servers)

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
- **apps/web**: Nuxt 4 + shadcn-vue + Tailwind CSS v4
- **apps/admin**: Nuxt 4 (planned)
- **packages/config**: Zod-validated env vars + feature flags + brand config
- **packages/db**: Prisma 7 + PostgreSQL 17
- **packages/shared**: Types, validators, constants shared between frontend/backend

## Key Conventions

### Feature flags — two tiers
- **Infrastructure flags**: Env vars (`FEATURE_*`), read at startup, require redeploy
- **Business flags**: Stored in DB (`FeatureFlag` table), togglable at runtime via admin

### Architectural invariant
Core modules (Config, Database, Auth) NEVER import optional modules (Stripe, Redis).
Communication between them happens via EventBus only.
Email and Storage are always-loaded core modules (not feature-flagged).

### App configuration — single source of truth
`src/configure-app.ts` is shared between `main.ts` and e2e tests.
NEVER add middleware directly in `main.ts` — add it to `configureApp()`.

### API response shape
- Success: `{ data: T }`
- Error: `{ error: { code: string, message: string, details?: [] } }`
- Exception: `/health` returns raw (not wrapped)

### Testing — three levels
- **Unit tests** (`apps/api/src/**/*.spec.ts`): Mocked dependencies, fast, run with `pnpm test`
- **API e2e tests** (`apps/api/test/e2e/**/*.spec.ts`): Real DB on port 5433, sequential, run with `pnpm --filter @paisa/api test:e2e`
- **Frontend e2e tests** (`e2e/tests/**/*.spec.ts`): Playwright + real browser + real API + real DB, run with `pnpm test:e2e:web`
- Factories in `test/factories/` — use these, don't write raw `prisma.create()`
- Every API e2e test file: `beforeEach(() => resetDatabase(prisma))`
- Stripe SDK is mocked in all tests (unit and e2e) — never hits real Stripe
- Stripe unit tests: direct constructor instantiation with `vi.fn()` mocks (no NestJS TestingModule)
- Stripe e2e tests: `createTestApp({ customize })` with `overrideProvider(STRIPE_CLIENT).useValue(mockStripe)`
- `.env.test` has `FEATURE_STRIPE_ENABLED=true` with fake keys so the module loads in e2e
- Test factories: `createProduct`, `createPlan`, `createSubscription`, `createPayment`, `createStripeCustomer`

### Frontend Playwright e2e tests
- Config: `e2e/playwright.config.ts` — starts both API (port 3001) and Nuxt (port 3000) automatically
- Global setup: `e2e/global-setup.ts` — waits for postgres-test, runs migrations, builds packages
- Fixtures: `e2e/fixtures/index.ts` — `resetDb` auto-fixture truncates all tables before each test, `api` fixture provides `APIRequestContext` for direct API calls
- Test infrastructure: `apps/api/src/test/test.module.ts` + `test.controller.ts` — test-only HTTP endpoints (POST /test/reset-database, GET /test/emails, DELETE /test/emails). Only loaded when `NODE_ENV=test`.
- Email testing: Email is always enabled. In test mode (`NODE_ENV=test`), `InMemoryEmailProvider` captures emails → Playwright reads them via `GET /test/emails`. Use `waitForEmails()` helper for polling (email sending is async via EventBus).
- Selector strategy: Use `page.locator('#id')` for form inputs (reka-ui Label doesn't work with Playwright's `getByLabel()`). Use `getByRole()` for headings/buttons. Use `exact: true` when names are ambiguous.
- All forms use `novalidate` attribute so Zod validation handles everything (prevents browser HTML5 validation tooltips from interfering).
- `reuseExistingServer: true` in dev — if API/Nuxt are already running, Playwright reuses them. Kill stale servers if env vars need to change.

### Package builds (tsup)
- `@paisa/config`, `@paisa/shared`, `@paisa/db` compile TS → JS via tsup
- **Dual-format builds**: `@paisa/config` and `@paisa/shared` output both CJS (`.js`) and ESM (`.mjs`). NestJS consumes CJS, Vite/Nuxt consumes ESM.
- `"exports"` field in package.json: `"types"` first, then `"import"` (mjs), then `"require"` (js). Order matters — esbuild warns if types isn't first.
- `"main"` points to `./dist/index.js` (CJS fallback), `"module"` points to `./dist/index.mjs` (ESM)
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
- WebAuthn challenge store: In-memory Map with 60s TTL, periodic cleanup, MAX_CHALLENGES=10,000 cap (Phase 8 → Redis).
- `configureApp()` applies Helmet, cookies, CORS, filters, interceptors. Shared by main.ts and tests.
- Domain events: Auth emits events (user.registered, user.logged_in, etc.) via EventBus. Email module listens.
- Google OAuth: Feature-flagged via `FEATURE_AUTH_GOOGLE_ENABLED`. Uses `passport-google-oauth20`.
  - `GoogleStrategy` is always registered in providers; `GoogleOAuthGuard` checks the feature flag and returns 404 if disabled.
  - Callback flow: `/auth/google/callback` sets refresh cookie + redirects to `FRONTEND_URL/auth/callback?token=<accessToken>&expiresIn=<expiresIn>`. Frontend reads token from URL, stores in memory, clears URL.
  - Account linking: If a user with the same email exists (email/password), the Google account is linked. No duplicate users. Email is auto-verified.
  - New users via OAuth have `passwordHash: null` and `emailVerified: true`.
  - **Setup guide** (when forking the boilerplate):
    1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project
    2. **APIs & Services → OAuth consent screen** → External → fill app name, support email, authorized domains
    3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
       - Application type: **Web application**
       - Authorized JavaScript origins: `http://localhost:3000` (dev), `https://yourdomain.com` (prod)
       - Authorized redirect URIs: `http://localhost:3001/auth/google/callback` (dev), `https://api.yourdomain.com/auth/google/callback` (prod)
    4. Copy Client ID and Client Secret into `.env`:
       ```
       FEATURE_AUTH_GOOGLE_ENABLED=true
       GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
       GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
       GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
       ```
    5. Restart the API server — "Continue with Google" buttons on login/register are always visible but the backend returns 404 when the flag is off
    6. For production: update `GOOGLE_CALLBACK_URL` to your real API domain, add production origins/redirects in Google Console, and publish the OAuth consent screen
- Passkeys (WebAuthn): Feature-flagged via `FEATURE_AUTH_PASSKEY_ENABLED` (default: true). Uses `@simplewebauthn/server` v13.
  - `PasskeyService` handles two WebAuthn ceremonies: registration (adding a passkey) and authentication (logging in).
  - `PasskeyGuard` checks the feature flag at controller level, returns 404 when disabled (same pattern as `GoogleOAuthGuard`).
  - `PasskeyController` has 7 endpoints under `/auth/passkey/`: register/options, register/verify, login/options, login/verify, list, rename, delete.
  - Registration endpoints are authenticated (JWT required). Login endpoints are `@Public()`.
  - Challenge store: In-memory Map keyed by `reg:{userId}` or `auth:{sessionId}`. Challenges expire after 60s, single-use (consumed on verification).
  - Authentication uses an opaque random `sessionId` (not the challenge value) to key stored challenges. Frontend sends sessionId back during verification.
  - Counter tracking: Stored per-passkey, updated after each authentication (clone detection).
  - Env vars: `WEBAUTHN_RP_NAME` (display name), `WEBAUTHN_RP_ID` (domain, e.g. `localhost`), `WEBAUTHN_ORIGIN` (full origin, e.g. `http://localhost:3000`).
  - Frontend: `usePasskey()` composable wraps `@simplewebauthn/browser` for registration, authentication, and passkey management.
- Set password: `POST /auth/set-password` allows OAuth-only users (passwordHash: null) to add a password.
  - Guards: user must exist, must NOT have existing password (throws 409 ConflictException).
  - Frontend: `security.vue` shows "Set password" form (v-if="!user?.hasPassword") vs "Change password" form (v-else).
- Shared auth helpers: `auth.helpers.ts` contains `setRefreshCookie()`, `toAuthUser()`, `parseExpiryToMs()` — shared between `AuthController` and `PasskeyController`. `auth.constants.ts` exports `REFRESH_TOKEN_COOKIE`.
- `hasPasskey` optimization: NOT queried on every authenticated request (removed from JwtStrategy to avoid per-request DB cost). Only populated by `GET /auth/me`, login responses, and register responses via `toAuthUser()`.
- `hasPassword` boolean: Derived from `!!user.passwordHash` in JWT strategy and `toAuthUser()`. Drives the frontend set-password vs change-password UI.
- Email module: Always enabled (core functionality). Three-tier provider setup by `NODE_ENV`:
  - Development (`NODE_ENV=development`): ConsoleEmailProvider — prints emails to terminal
  - Test (`NODE_ENV=test`): InMemoryEmailProvider — captures emails for assertions via `getSentEmails()`
  - Production (`NODE_ENV=production`): ResendEmailProvider — real delivery via Resend API (requires `RESEND_API_KEY`, `EMAIL_FROM`)
  - Templates are pure functions in `email/templates/` — no templating engine, just TypeScript string functions
  - Event listener (`email-event.listener.ts`) subscribes to domain events via `@OnEvent()` — all handlers wrap in try/catch (emails are best-effort, never break auth flows)
- Storage module: Always enabled (core functionality). Provider selected by `STORAGE_PROVIDER` env var:
  - `local` (default): LocalStorageProvider — saves to `uploads/` directory, served via Express static middleware
  - `r2`: R2StorageProvider — uploads to Cloudflare R2 via S3 SDK (requires R2 credentials)
- Conditional module loading: `AppModule` computes `optionalModules` array at module-evaluation time using `parseFeatures(process.env)` for Stripe, Redis, RabbitMQ, WebSockets, Sentry

### Stripe Payments & Subscriptions
- Feature-flagged via `FEATURE_STRIPE_ENABLED` (default: false). Conditionally loaded in `AppModule` via `parseFeatures(process.env)`.
- Webhook-first architecture: subscriptions and payments are only created by webhook handlers, never by success page redirect. The checkout success page simply confirms — it never writes to DB.
- Stripe Checkout (hosted): redirect users to Stripe-hosted payment page, no PCI compliance needed on our side.
- Lazy customer creation: Stripe Customer is created at first checkout, not at user registration.
- Database = catalog (products/plans power the pricing page), Stripe = payments (all money handling).
- `stripe-types.ts`: Stripe SDK v22 CJS exports a constructor, not a class. Our type helper re-exports the `Stripe` class type from `stripe/cjs/stripe.core.js`. All services use `import type { Stripe } from '../stripe-types'`.
- API version pinned to `2026-03-25.dahlia` (SDK v22). In this version: `current_period_start/end` moved to SubscriptionItem, `invoice.subscription` replaced with `invoice.parent.subscription_details.subscription`.
- Raw body middleware in `configure-app.ts` for webhook signature verification (Express JSON middleware destroys raw bytes).
- Cross-module communication via EventBus (emits SUBSCRIPTION_CREATED, SUBSCRIPTION_CANCELED, PAYMENT_SUCCEEDED, etc.).
- DynamicModule pattern: `StripeModule.register()` follows same pattern as `StorageModule.register()`.
- Endpoints:
  ```
  GET  /stripe/pricing              → Public pricing page data
  POST /stripe/checkout             → Create Checkout Session (→ redirect URL)
  GET  /stripe/subscription         → Get active subscription
  GET  /stripe/purchases            → All subscriptions + payments
  POST /stripe/subscription/cancel  → Cancel at period end
  POST /stripe/subscription/resume  → Resume pending cancellation
  POST /stripe/portal               → Stripe Billing Portal (→ redirect URL)
  POST /stripe/webhooks             → Stripe webhook receiver (signature verified)
  ```
- **Setup guide** (when forking the boilerplate):
  1. Create a Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
  2. Get your test API keys from Developers → API Keys
  3. Set up a webhook endpoint (Developers → Webhooks):
     - URL: `https://your-api.com/stripe/webhooks`
     - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
  4. Add to `.env`:
     ```
     FEATURE_STRIPE_ENABLED=true
     STRIPE_SECRET_KEY=sk_test_xxx
     STRIPE_WEBHOOK_SECRET=whsec_xxx
     STRIPE_PUBLISHABLE_KEY=pk_test_xxx
     ```
  5. Create products and plans in Stripe Dashboard or via seed script
  6. Run database seed: `pnpm --filter @paisa/db db:seed`
  7. For local development: use Stripe CLI to forward webhooks:
     ```
     stripe listen --forward-to localhost:3001/stripe/webhooks
     ```

### Nuxt Frontend (apps/web)
- Nuxt 4.4+ with native `app/` directory structure
- shadcn-vue for UI components (not Nuxt UI). Components live in `app/components/ui/`.
- Tailwind CSS v4 via `@tailwindcss/vite` Vite plugin (not `@nuxtjs/tailwindcss`). Config is CSS-first in `app/assets/css/tailwind.css`.
- Colors use OKLCH color space (not HSL). Theme variables defined in CSS, mapped via `@theme inline`.
- Add new shadcn components: `pnpm dlx shadcn-vue@latest add <component>` from `apps/web/`.
- Auth: Access token in memory-only JS variable (XSS-safe), refresh token in httpOnly cookie.
  - `useAuth()` composable: central auth state, token management, API helpers.
  - `auth.client.ts` plugin: restores session on page load via silent refresh.
  - `auth` middleware: protects routes, waits for auth loading to resolve.
  - `guest` middleware: redirects authenticated users away from login/register.
  - OAuth callback: `/auth/callback` reads token from URL query, stores in memory, clears URL.
  - `usePasskey()` composable: wraps `@simplewebauthn/browser` for passkey registration, login, list, rename, delete. Exports `PasskeyInfo` type (auto-imported by Nuxt).
- Zod schemas from `@paisa/shared` used for both client-side validation and API validation.
- `cn()` utility in `app/lib/utils.ts` for merging Tailwind classes (clsx + tailwind-merge).
- Billing: `useBilling()` composable wraps all Stripe interactions — pricing, subscription, checkout, cancel, resume, portal redirect.
  - Pricing page (`/pricing`): public route, feature-flag gated via `useFeatureFlags()`. Fetches products/plans from `GET /stripe/pricing`.
  - Billing settings (`/settings/billing`): authenticated, shows active subscription with cancel/resume, portal link, purchase history.
  - Checkout success/cancel pages handle redirect back from Stripe Checkout.
  - `SettingsNav` conditionally shows Billing link when `stripe` feature flag is enabled.
- Auth pages: Stripe-inspired design with gradient background, borderless shadow cards, horizontal social login buttons, inline "Forgot password?" link.

### Rate Limiting
- Global rate limiting via `@nestjs/throttler` with two tiers:
  - **Default** (all endpoints): 60 requests per 60 seconds per IP
  - **Strict** (auth-sensitive): 5 requests per 60 seconds per IP
- `ThrottleModule` in `src/core/throttle/` registers `ThrottlerGuard` as a global `APP_GUARD`.
- `@StrictThrottle()` decorator applied to: login, register, forgot-password, reset-password, resend-verification, passkey login options/verify.
- `@SkipThrottle()` applied to Stripe webhooks (requests from Stripe servers, not users).
- Storage: In-memory by default. Switch to `ThrottlerStorageRedisService` when Redis is enabled.

## Documentation

- `docs/request-lifecycle.md` — Mermaid diagrams showing the full request flow through the API
- `e2e/playwright.config.ts` — Playwright config with multi-server setup, env vars, and browser config
- `e2e/fixtures/index.ts` — Custom fixtures (resetDb, api) and TEST_USER constants
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
- **OAuth callback uses `@Res()` not `@Res({ passthrough: true })`**: Because it issues a redirect, not a JSON response. NestJS interceptors are bypassed.
- **GoogleStrategy always registered**: Even when the feature flag is off. `GoogleOAuthGuard` prevents invocation — avoids dynamic module complexity.
- **Email config in dev/test**: Email is always enabled. `RESEND_API_KEY` is only required in production — dev/test use Console/InMemory providers that don't need it.
- **Health e2e test**: Don't hardcode feature flag booleans — they change with `.env`. Use `expect.any(Boolean)` instead.
- **Tailwind v4 ≠ v3**: No `tailwind.config.ts` — configuration is CSS-first via `@theme inline` in `tailwind.css`. Do NOT install `@nuxtjs/tailwindcss`.
- **shadcn-vue components are local**: They live in `app/components/ui/` as source files you own. Edit them freely. Add new ones with `pnpm dlx shadcn-vue@latest add <name>`.
- **`nuxi prepare` before shadcn init**: `.nuxt` types must exist for the shadcn CLI to resolve paths.
- **Auth middleware waits for loading**: Both `auth.ts` and `guest.ts` middleware watch `isLoading` to avoid incorrect redirects during session restoration on page refresh.
- **EmailModule is global**: `EmailModule.register()` sets `global: true` so `EMAIL_PROVIDER` is injectable in any module (e.g. `TestModule`).
- **TestModule only in test**: `TestModule` is conditionally imported in `AppModule` via `...(process.env.NODE_ENV === 'test' ? [TestModule] : [])`. In production, the endpoints don't exist at all.
- **Playwright `getByLabel()` + reka-ui**: Playwright can't resolve labels through reka-ui's Label component chain. Use `page.locator('#id')` for form inputs instead.
- **Playwright reuses running servers**: With `reuseExistingServer: true`, if the API is already running with `NODE_ENV=development`, email tests will fail because `InMemoryEmailProvider` is only used in test mode. Kill stale servers before running `pnpm test:e2e:web`.
- **Helmet CORP blocks cross-origin images**: Helmet's default `Cross-Origin-Resource-Policy: same-origin` blocks the browser from loading images served by the API (port 3001) when the page is on the frontend (port 3000). Set `crossOriginResourcePolicy: { policy: 'cross-origin' }` in Helmet config since the API is consumed cross-origin by design.
- **Don't name composables `useAppConfig`**: Nuxt has a built-in `useAppConfig` composable. Shadowing it causes warnings and breaks auto-imports. Our feature flags composable is named `useFeatureFlags` to avoid this.
- **Feature flags for frontend**: `useFeatureFlags()` composable fetches `GET /config` on app startup via `config.client.ts` plugin. Caches in `useState`. Used to conditionally show/hide Google OAuth buttons and other feature-gated UI.
- **`PublicConfigController`**: Dedicated `GET /config` endpoint exposes client-safe feature flags (auth providers, Stripe). Lives in `CoreConfigModule`. Never exposes secrets — only booleans.
- **Passkey feature defaults to enabled**: Unlike Google OAuth (defaults off), passkeys default to enabled. Requires `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` env vars to be correctly set. Set `FEATURE_AUTH_PASSKEY_ENABLED=false` to disable.
- **`hasPasskey` is false in JWT strategy**: To avoid a DB query on every authenticated request, `hasPasskey` is hardcoded `false` in `JwtStrategy.validate()`. The real value is populated by `GET /auth/me` and login/register response builders. Don't rely on `@CurrentUser().hasPasskey` in arbitrary endpoints.
- **WebAuthn challenge store is in-memory**: Same limitation as email tokens. Won't work across multiple server instances. Phase 8 → Redis.
- **Passkey e2e tests can't test full ceremonies**: WebAuthn requires a browser authenticator. E2e tests cover CRUD, auth requirements, and feature flag gating but not the actual crypto verification flow (tested by @simplewebauthn/server internally).
- **`@simplewebauthn/server` + `@simplewebauthn/browser`**: Must stay version-aligned. Currently both at v13. The server package validates credential formats strictly (e.g., credentialId must be valid base64url).
- **Stripe SDK v22 CJS types**: `import Stripe from 'stripe'` gives `StripeConstructor` (a function), not the `Stripe` class. Use `import type { Stripe } from '../stripe-types'` for type annotations. Only use `import StripeSDK from 'stripe'` in `stripe.module.ts` for the runtime constructor.
- **Stripe API 2026-03-25.dahlia breaking changes**: `current_period_start/end` moved from Subscription to SubscriptionItem. `invoice.subscription` removed, use `invoice.parent?.subscription_details?.subscription`.
- **Raw body for webhooks**: Express JSON middleware destroys raw bytes needed for Stripe signature verification. Custom middleware in `configure-app.ts` captures Buffer to `req.rawBody` before JSON parsing.
- **Webhook idempotency**: All Stripe webhook handlers use Prisma `upsert` — safe against Stripe retries.
- **E2e Stripe module loading**: `AppModule` evaluates `parseFeatures(process.env)` at import time. `.env.test` must set `FEATURE_STRIPE_ENABLED=true` so the module loads. Provider override via `createTestApp({ customize })` replaces the SDK with a mock.
- **Rate limiting in e2e tests**: ThrottlerGuard uses in-memory counters. E2e tests that send many requests to strict endpoints may hit the 5/min limit. Consider `@SkipThrottle()` or higher limits in test env if needed.
