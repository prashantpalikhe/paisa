# Paisa Boilerplate — Architecture

> A production-ready, brandable, pluggable monorepo boilerplate for building SaaS applications.
> Fork it, configure it, ship it.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Feature Toggle System](#4-feature-toggle-system)
5. [Backend — NestJS API](#5-backend--nestjs-api)
6. [Frontend — Nuxt 4](#6-frontend--nuxt-4)
7. [Admin Panel](#7-admin-panel)
8. [Database — Prisma + PostgreSQL](#8-database--prisma--postgresql)
9. [Authentication](#9-authentication)
10. [Email System](#10-email-system)
11. [Payments — Stripe](#11-payments--stripe)
12. [Caching — Redis](#12-caching--redis)
13. [Message Queue — RabbitMQ](#13-message-queue--rabbitmq)
14. [File Storage — Cloudflare R2](#14-file-storage--cloudflare-r2)
15. [WebSockets — Socket.io](#15-websockets--socketio)
16. [Error Tracking — Sentry](#16-error-tracking--sentry)
17. [Logging — Pino](#17-logging--pino)
18. [API Documentation — Scalar](#18-api-documentation--scalar)
19. [Branding System](#19-branding-system)
20. [Local Development](#20-local-development)
21. [Deployment — Dev → Test → Production](#21-deployment--dev--test--production)
22. [CI/CD — GitHub Actions](#22-cicd--github-actions)
23. [Testing Strategy](#23-testing-strategy)
24. [Security](#24-security)
25. [Rate Limiting](#25-rate-limiting)
26. [Marketing & Pricing Pages](#26-marketing--pricing-pages)
27. [Architectural Invariants](#27-architectural-invariants)
28. [Implementation Phases](#28-implementation-phases)

---

## 1. Philosophy

- **Fork and go.** Every new project starts from this boilerplate. Auth, payments, emails, admin — all ready.
- **Pluggable.** Every integration is toggleable via a single config. Disable Stripe? The app still runs. Disable RabbitMQ? No errors, no dead code paths.
- **Brandable.** One config file changes colors, fonts, logo, app name. The entire frontend updates.
- **State of the art.** Latest stable versions. No legacy patterns. Modern defaults.
- **Production-ready.** Not a toy. Proper error handling, logging, monitoring, rate limiting, security headers, CORS, CSRF protection.
- **Tested end-to-end.** Auth flows, payment flows, email flows — all covered by automated tests.

---

## 2. Tech Stack

### Core Versions

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS | Runtime |
| pnpm | 10.x | Package manager |
| Turborepo | 2.x | Monorepo build orchestration |
| TypeScript | 5.x | Strict mode everywhere |

### Backend

| Tool | Version | Package |
|---|---|---|
| NestJS | 11.x | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` |
| Prisma | 7.x | `prisma`, `@prisma/client` (with `moduleFormat = "cjs"`) |
| Passport | latest | `@nestjs/passport`, `passport`, `passport-local`, `passport-jwt`, `passport-google-oauth20` |
| SimpleWebAuthn | 11.x | `@simplewebauthn/server` |
| otpauth | latest | TOTP-based 2FA |
| argon2 | latest | Password hashing |
| Stripe | 15.x | `stripe` |
| Resend | 4.x | `resend` |
| React Email | 1.x | `@react-email/components`, `@react-email/render` |
| Pino | latest | `nestjs-pino`, `pino-pretty` |
| Socket.io | latest | `@nestjs/websockets`, `@nestjs/platform-socket.io` |
| cache-manager | 7.x | `@nestjs/cache-manager`, `cache-manager-redis-yet` |
| RabbitMQ | — | `@nestjs/microservices` (Transport.RMQ) |
| Scalar | latest | `@scalar/nestjs-api-reference` |
| Sentry | latest | `@sentry/nestjs` |
| Zod | latest | Request/response validation |
| Cloudflare R2 | — | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |

### Frontend

| Tool | Version | Package |
|---|---|---|
| Nuxt | 4.x | `nuxt` |
| shadcn-vue | 2.5.x | `shadcn-nuxt` (auto-imports, OKLCH theming) |
| Tailwind CSS | 4.x | `tailwindcss`, `@tailwindcss/vite` |
| Pinia | latest | `@pinia/nuxt` |
| Sentry | 10.x | `@sentry/nuxt` |
| SimpleWebAuthn | 11.x | `@simplewebauthn/browser` |

### Infrastructure

| Concern | Local Dev | Production |
|---|---|---|
| PostgreSQL | Docker Compose | Railway (managed) |
| Redis | Docker Compose | Railway (managed) |
| RabbitMQ | Docker Compose | Railway (Docker service) |
| NestJS API | `pnpm dev` (native) | Railway (Dockerfile) |
| Nuxt frontend | `pnpm dev` (native) | Vercel |
| Nuxt admin | `pnpm dev` (native) | Vercel |
| File storage | Local disk (`./uploads`) | Cloudflare R2 |
| Email | Resend (test mode) / local preview | Resend |
| Payments | Stripe test mode + CLI | Stripe live mode |

---

## 3. Monorepo Structure

```
paisa/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── core/                 # Always-on foundational modules
│   │   │   │   ├── config/           # Typed config, env validation (Zod)
│   │   │   │   ├── database/         # Prisma module, health check
│   │   │   │   ├── logging/          # Pino logger setup
│   │   │   │   └── health/           # Health check controller
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # Authentication (always-on)
│   │   │   │   │   ├── strategies/   # passport-local, passport-jwt, passport-google
│   │   │   │   │   ├── guards/       # JwtAuthGuard, RolesGuard, TwoFactorGuard
│   │   │   │   │   ├── passkey/      # WebAuthn registration + authentication
│   │   │   │   │   ├── two-factor/   # TOTP setup, verify, backup codes
│   │   │   │   │   ├── dto/          # Login, Register, ResetPassword DTOs
│   │   │   │   │   └── auth.module.ts
│   │   │   │   ├── user/             # User CRUD, profile, avatar
│   │   │   │   ├── email/            # Resend integration (toggleable)
│   │   │   │   │   └── email.module.ts  # Imports templates from @paisa/email-templates
│   │   │   │   ├── stripe/           # Payments, subscriptions, webhooks (toggleable)
│   │   │   │   │   ├── stripe.controller.ts
│   │   │   │   │   ├── stripe-webhook.controller.ts
│   │   │   │   │   ├── stripe.service.ts
│   │   │   │   │   └── stripe.module.ts
│   │   │   │   ├── queue/            # RabbitMQ producer/consumer (toggleable)
│   │   │   │   ├── cache/            # Redis caching layer (toggleable)
│   │   │   │   ├── storage/          # R2 file uploads + presigned URLs (toggleable)
│   │   │   │   ├── websocket/        # Socket.io gateway (toggleable)
│   │   │   │   ├── sentry/           # Sentry error tracking (toggleable)
│   │   │   │   └── admin/            # Admin-only endpoints (user mgmt, plans, etc.)
│   │   │   ├── common/
│   │   │   │   ├── decorators/       # @CurrentUser, @Public, @Roles, @ApiPagination
│   │   │   │   ├── guards/           # ThrottlerGuard (Redis-backed)
│   │   │   │   ├── interceptors/     # Transform, Timeout, Logging
│   │   │   │   ├── filters/          # Global exception filter
│   │   │   │   ├── pipes/            # ZodValidation pipe
│   │   │   │   └── types/            # Shared backend types
│   │   │   ├── app.module.ts         # Root module — conditional imports
│   │   │   └── main.ts              # Bootstrap
│   │   ├── test/
│   │   │   ├── e2e/                  # API e2e tests
│   │   │   └── helpers/              # Test factories, seeding
│   │   ├── Dockerfile                # Production container
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── web/                          # Nuxt 4 — customer-facing frontend
│   │   ├── app/
│   │   │   ├── assets/
│   │   │   │   └── css/
│   │   │   │       └── tailwind.css  # Tailwind + shadcn-vue CSS variables
│   │   │   ├── components/
│   │   │   │   ├── ui/              # shadcn-vue components (auto-generated)
│   │   │   │   ├── auth/            # AuthForm, PasskeyButton, TwoFactorInput
│   │   │   │   ├── billing/         # PricingTable, SubscriptionCard
│   │   │   │   ├── marketing/       # Hero, Features, Testimonials, Footer
│   │   │   │   └── layout/          # Navbar, Sidebar, MobileNav
│   │   │   ├── composables/
│   │   │   │   ├── useAuth.ts       # Login, logout, register, current user
│   │   │   │   ├── useApi.ts        # Typed fetch wrapper for NestJS API
│   │   │   │   ├── useStripe.ts     # Checkout, portal redirect (feature-gated)
│   │   │   │   ├── useSocket.ts     # WebSocket connection (feature-gated)
│   │   │   │   └── useFeatures.ts   # Feature flag access
│   │   │   ├── layouts/
│   │   │   │   ├── default.vue      # App layout (nav + content)
│   │   │   │   ├── auth.vue         # Centered card layout for auth pages
│   │   │   │   └── marketing.vue    # Marketing pages layout
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts          # Redirect to login if not authenticated
│   │   │   │   └── guest.ts         # Redirect to dashboard if authenticated
│   │   │   ├── pages/
│   │   │   │   ├── index.vue        # Marketing landing page
│   │   │   │   ├── pricing.vue      # Dynamic pricing from API
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login.vue
│   │   │   │   │   ├── register.vue
│   │   │   │   │   ├── forgot-password.vue
│   │   │   │   │   ├── reset-password.vue
│   │   │   │   │   ├── verify-email.vue
│   │   │   │   │   └── two-factor.vue
│   │   │   │   ├── dashboard/       # Protected app pages (placeholder)
│   │   │   │   │   └── index.vue
│   │   │   │   └── account/
│   │   │   │       ├── index.vue        # Profile settings
│   │   │   │       ├── security.vue     # Password, passkeys, 2FA
│   │   │   │       └── billing.vue      # Subscription management
│   │   │   └── plugins/
│   │   │       ├── sentry.client.ts     # Conditional Sentry init
│   │   │       └── socket.client.ts     # Conditional Socket.io init
│   │   ├── server/                       # Nuxt server routes (minimal, mostly proxy)
│   │   ├── public/
│   │   │   ├── logo.svg
│   │   │   └── favicon.ico
│   │   ├── nuxt.config.ts
│   │   └── package.json
│   │
│   └── admin/                        # Nuxt 4 — admin backoffice
│       ├── app/
│       │   ├── components/
│       │   │   └── ui/              # Shared shadcn-vue components
│       │   ├── pages/
│       │   │   ├── index.vue        # Dashboard overview
│       │   │   ├── users/
│       │   │   │   ├── index.vue    # User list, search, filter
│       │   │   │   └── [id].vue     # User detail, impersonate, ban
│       │   │   ├── products/
│       │   │   │   ├── index.vue    # Product + plan management
│       │   │   │   └── [id].vue     # Edit product, sync to Stripe
│       │   │   ├── subscriptions/
│       │   │   │   └── index.vue    # Active subscriptions overview
│       │   │   ├── emails/
│       │   │   │   └── index.vue    # Email template preview + test send
│       │   │   ├── queues/
│       │   │   │   └── index.vue    # RabbitMQ queue health, dead letters
│       │   │   ├── features/
│       │   │   │   └── index.vue    # Feature flags toggle UI
│       │   │   └── system/
│       │   │       └── index.vue    # Health, cache stats, connected sockets
│       │   ├── composables/
│       │   ├── layouts/
│       │   └── middleware/
│       │       └── admin.ts         # Verify admin role
│       ├── nuxt.config.ts
│       └── package.json
│
├── packages/
│   ├── config/                       # Shared configuration
│   │   ├── features.ts              # Feature toggle definitions
│   │   ├── env.ts                   # Zod env validation schemas
│   │   ├── brand.ts                 # Branding configuration
│   │   └── package.json
│   │
│   ├── db/                          # Prisma — single source of truth for schema
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema
│   │   │   ├── migrations/          # Migration history
│   │   │   └── seed.ts              # Seed admin user, sample products/plans
│   │   ├── index.ts                 # Re-exports PrismaClient + generated types
│   │   └── package.json
│   │
│   ├── shared/                      # Shared types, DTOs, constants
│   │   ├── types/
│   │   │   ├── auth.ts              # AuthUser, LoginRequest, RegisterRequest
│   │   │   ├── billing.ts           # Product, Plan, Subscription types
│   │   │   └── api.ts               # PaginatedResponse, ApiError, etc.
│   │   ├── validators/              # Shared Zod schemas (used by both API + frontend)
│   │   │   ├── auth.ts
│   │   │   └── billing.ts
│   │   ├── constants/
│   │   │   └── index.ts             # Roles, subscription statuses, etc.
│   │   └── package.json
│   │
│   └── email-templates/             # React Email templates (shared, rendered by API)
│       ├── src/
│       │   ├── welcome.tsx
│       │   ├── verify-email.tsx
│       │   ├── reset-password.tsx
│       │   ├── two-factor-code.tsx
│       │   ├── payment-confirmation.tsx
│       │   └── components/          # Shared email components (Header, Footer, Button)
│       ├── package.json             # react, react-dom, @react-email/* as deps
│       └── tsconfig.json
│
├── docker/
│   └── docker-compose.yml           # PostgreSQL, Redis, RabbitMQ
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Lint, typecheck, unit tests, e2e tests
│       ├── deploy-api.yml           # Deploy NestJS to Railway (on main push)
│       └── preview-api.yml          # Deploy preview env on PR
│
├── turbo.json                       # Task pipeline: build, dev, test, lint, typecheck
├── pnpm-workspace.yaml              # Workspace definitions
├── .env.example                     # All env vars documented
├── .nvmrc                           # Node 22
├── ARCHITECTURE.md                  # This file
└── README.md                        # Setup instructions
```

---

## 4. Feature Toggle System

### Central Configuration

Every optional integration is controlled by a feature flag. The config lives in `packages/config/features.ts` and is validated by Zod at startup — if a feature is enabled but its required env vars are missing, the app fails fast with a clear error.

```typescript
// packages/config/features.ts
import { z } from 'zod';

// Helper: when enabled, listed fields become required.
// When disabled, they remain optional and the module is not loaded.
function requiredWhenEnabled<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  requiredFields: (keyof T)[],
  featureName: string,
) {
  return schema.refine(
    (data: any) => {
      if (!data.enabled) return true;
      return requiredFields.every((f) => data[f] != null && data[f] !== '');
    },
    {
      message: `${featureName} requires [${requiredFields.join(', ')}] when enabled`,
    },
  );
}

export const featuresSchema = z.object({
  auth: z.object({
    google: requiredWhenEnabled(
      z.object({
        enabled: z.boolean(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      }),
      ['clientId', 'clientSecret'],
      'Google OAuth',
    ),
    passkey: z.object({ enabled: z.boolean() }),
    twoFactor: z.object({ enabled: z.boolean() }),
  }),
  email: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      provider: z.enum(['resend']).default('resend'),
      apiKey: z.string().optional(),
      fromAddress: z.string().optional(),
    }),
    ['apiKey', 'fromAddress'],
    'Email (Resend)',
  ),
  stripe: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      secretKey: z.string().optional(),
      webhookSecret: z.string().optional(),
      publishableKey: z.string().optional(),
    }),
    ['secretKey', 'webhookSecret', 'publishableKey'],
    'Stripe',
  ),
  redis: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      url: z.string().optional(),
    }),
    ['url'],
    'Redis',
  ),
  rabbitmq: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      url: z.string().optional(),
    }),
    ['url'],
    'RabbitMQ',
  ),
  storage: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      provider: z.enum(['r2', 'local']).default('local'),
      r2AccountId: z.string().optional(),
      r2AccessKeyId: z.string().optional(),
      r2SecretAccessKey: z.string().optional(),
      r2BucketName: z.string().optional(),
    }),
    // Only required when provider is 'r2' — validated separately below
    [],
    'Storage',
  ).refine(
    (data) => {
      if (!data.enabled || data.provider !== 'r2') return true;
      return data.r2AccountId && data.r2AccessKeyId && data.r2SecretAccessKey && data.r2BucketName;
    },
    { message: 'Storage (R2) requires r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName when provider is r2' },
  ),
  websockets: z.object({ enabled: z.boolean() }),
  sentry: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      dsn: z.string().optional(),
    }),
    ['dsn'],
    'Sentry',
  ),
});

export type Features = z.infer<typeof featuresSchema>;
```

Every feature now **fails fast** at startup with a clear message if enabled without its required env vars.

### Backend: Conditional Module Registration

```typescript
// apps/api/src/app.module.ts
@Module({
  imports: [
    // --- Always loaded ---
    CoreConfigModule,
    DatabaseModule,
    LoggingModule,
    HealthModule,
    AuthModule,
    UserModule,

    // --- Conditionally loaded ---
    // Each module's .register() returns the module or undefined
    ...[
      features.email.enabled     && EmailModule.register(),
      features.stripe.enabled    && StripeModule.register(),
      features.redis.enabled     && CacheModule.register(),
      features.rabbitmq.enabled  && QueueModule.register(),
      features.storage.enabled   && StorageModule.register(),
      features.websockets.enabled && WebsocketModule.register(),
      features.sentry.enabled   && SentryModule.register(),
    ].filter(Boolean),
  ],
})
export class AppModule {}
```

### Frontend: Conditional Plugin Loading

```typescript
// apps/web/nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    'shadcn-nuxt',
    '@pinia/nuxt',
    ...(features.sentry.enabled ? ['@sentry/nuxt/module'] : []),
  ],
  // Nuxt 4 runtime config: values here are build-time defaults.
  // At runtime (preview/production), override via NUXT_PUBLIC_* env vars:
  //   NUXT_PUBLIC_API_BASE_URL, NUXT_PUBLIC_SENTRY_DSN, etc.
  // See: https://nuxt.com/docs/guide/going-further/runtime-config
  runtimeConfig: {
    public: {
      apiBaseUrl: '',  // Override at runtime: NUXT_PUBLIC_API_BASE_URL
      features: {
        stripe: features.stripe.enabled,
        websockets: features.websockets.enabled,
        auth: {
          google: features.auth.google.enabled,
          passkey: features.auth.passkey.enabled,
          twoFactor: features.auth.twoFactor.enabled,
        },
      },
      sentry: {
        dsn: '',  // Override at runtime: NUXT_PUBLIC_SENTRY_DSN
      },
    },
  },
});
```

### Graceful Degradation in Frontend Components

```vue
<!-- Auth form conditionally shows Google/Passkey buttons -->
<template>
  <div>
    <EmailPasswordForm />
    <GoogleLoginButton v-if="features.auth.google" />
    <PasskeyLoginButton v-if="features.auth.passkey" />
  </div>
</template>

<script setup lang="ts">
const { features } = useFeatures();
</script>
```

---

## 5. Backend — NestJS API

### NestJS 11 Defaults

- **SWC compiler** (Rust-based, fast builds)
- **Vitest** as test runner
- **Express** as HTTP platform (`@nestjs/platform-express`)
- **Strict TypeScript** configuration

### Module Pattern

Every toggleable module follows the same pattern:

```typescript
// Example: modules/stripe/stripe.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigurableModuleBuilder } from '@nestjs/common';

@Module({})
export class StripeModule {
  static register(): DynamicModule {
    return {
      module: StripeModule,
      imports: [],
      providers: [StripeService, StripeWebhookService],
      controllers: [StripeController, StripeWebhookController],
      exports: [StripeService],
      global: false,
    };
  }
}
```

### Request Lifecycle

```
Request
  → Global Exception Filter (catches all, formats error response)
  → Global Logging Interceptor (Pino: log request/response)
  → Rate Limit Guard (ThrottlerGuard, Redis-backed if enabled)
  → Auth Guard (JWT validation, extracts user)
  → Role Guard (checks @Roles() decorator)
  → 2FA Guard (checks if 2FA verification needed)
  → Zod Validation Pipe (validates DTO)
  → Controller method
  → Response Transform Interceptor (standardizes response shape)
  → Response
```

### Standard Response Shape

All API responses follow a consistent shape:

```typescript
// Success
{
  "data": { ... },
  "meta": { "page": 1, "total": 100, "perPage": 20 }  // optional, for paginated
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [...]  // optional, field-level errors
  }
}
```

---

## 6. Frontend — Nuxt 4

### Key Nuxt 4 Conventions

- Source code in `app/` directory (Nuxt 4 default)
- File-based routing via `app/pages/`
- Auto-imported components from `app/components/`
- Auto-imported composables from `app/composables/`
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- shadcn-vue components in `app/components/ui/` (auto-imported by `shadcn-nuxt`)

### API Communication

A typed composable wraps `useFetch` for all API calls:

```typescript
// composables/useApi.ts
export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuth();

  function $api<T>(path: string, options?: UseFetchOptions<T>) {
    return useFetch<T>(`${config.public.apiBaseUrl}${path}`, {
      ...options,
      // credentials: 'include' is required so the browser sends the httpOnly
      // refresh token cookie cross-origin (local dev: different ports,
      // preview: different domains, production: api.* subdomain).
      credentials: 'include',
      headers: {
        ...options?.headers,
        Authorization: auth.token ? `Bearer ${auth.token}` : undefined,
      },
    });
  }

  return { $api };
}
```

### State Management

- **Pinia** for global state (auth state, feature flags)
- **Composables** for server state (API data via `useFetch` / `useAsyncData`)
- No need for Vuex or heavy state management — keep it simple

### Page Layout Map

| Page | Layout | Auth Required | Notes |
|---|---|---|---|
| `/` | `marketing` | No | Landing page |
| `/pricing` | `marketing` | No | Dynamic pricing from API |
| `/auth/login` | `auth` | No (guest only) | Email/pass + Google + passkey |
| `/auth/register` | `auth` | No (guest only) | Registration form |
| `/auth/forgot-password` | `auth` | No | Request reset email |
| `/auth/reset-password` | `auth` | No | Reset with token from email |
| `/auth/verify-email` | `auth` | No | Email verification link handler |
| `/auth/two-factor` | `auth` | Partial | 2FA code entry after login |
| `/dashboard` | `default` | Yes | App home (placeholder) |
| `/account` | `default` | Yes | Profile settings |
| `/account/security` | `default` | Yes | Password, passkeys, 2FA |
| `/account/billing` | `default` | Yes | Subscription management |

---

## 7. Admin Panel

Separate Nuxt 4 app (`apps/admin/`) deployed independently. Same API, admin-guarded endpoints.

### Admin Features

| Page | Description |
|---|---|
| Dashboard | User count, revenue, active subscriptions, error rate |
| Users | List, search, filter. View detail. Ban/unban. Impersonate. |
| Products & Plans | CRUD products and plans. Sync to Stripe. Toggle active/inactive. |
| Subscriptions | Active subscriptions overview. Cancel/refund from admin. |
| Email Templates | Preview rendered templates. Send test emails. |
| Queues | RabbitMQ queue depth, dead letter inspection, retry failed messages. |
| Feature Flags | Toggle **business-level** flags at runtime (e.g., maintenance mode, beta features, plan limits). Infrastructure integrations (Stripe, RabbitMQ, Redis, Sentry, etc.) are **startup-only** — toggling them requires a config change + redeploy. |
| System Health | API health, DB connection, Redis ping, RabbitMQ status, Sentry test. |

### Admin Authentication

- Same JWT auth as main app
- `@Roles('admin')` guard on all admin API endpoints
- Admin role assigned via database seed or existing admin panel
- Impersonation: Admin can act as any user (logged, auditable, time-limited token)

---

## 8. Database — Prisma + PostgreSQL

### Prisma 7 Configuration

```prisma
// packages/db/prisma/schema.prisma
generator client {
  provider     = "prisma-client-js"
  moduleFormat = "cjs"  // Required: Prisma 7 defaults to ESM, NestJS needs CJS
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Core Schema

```prisma
// ─── Users ───

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?   // null for OAuth-only users
  emailVerified   Boolean   @default(false)
  emailVerifiedAt DateTime?
  role            Role      @default(USER)
  avatarUrl       String?
  name            String?
  banned          Boolean   @default(false)
  bannedAt        DateTime?
  bannedReason    String?

  // Relations
  oauthAccounts   OAuthAccount[]
  passkeys        Passkey[]
  twoFactorAuth   TwoFactorAuth?
  refreshTokens   RefreshToken[]
  stripeCustomer  StripeCustomer?
  subscriptions   Subscription[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([email])
}

enum Role {
  USER
  ADMIN
}

// ─── OAuth ───

model OAuthAccount {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       String   // "google"
  providerUserId String
  accessToken    String?
  refreshToken   String?
  expiresAt      DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([provider, providerUserId])
  @@index([userId])
}

// ─── Passkeys (WebAuthn) ───

model Passkey {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  credentialId        String   @unique  // base64url-encoded credential ID
  credentialPublicKey Bytes    // stored as raw bytes
  counter             BigInt   @default(0)
  transports          String[] // ["usb", "ble", "nfc", "internal"]
  deviceName          String?  // user-friendly name for management UI

  createdAt           DateTime @default(now())

  @@index([userId])
}

// ─── Two-Factor Authentication ───

model TwoFactorAuth {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  secret      String   // encrypted TOTP secret
  backupCodes String[] // hashed backup codes
  verified    Boolean  @default(false) // true after first successful verification

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── Session / Refresh Tokens ───

model RefreshToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique // hashed token, never store raw
  family      String   // token family for rotation detection
  expiresAt   DateTime
  revokedAt   DateTime?
  userAgent   String?
  ipAddress   String?

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([tokenHash])
  @@index([family])
}

// ─── Payments (Stripe) ───

model StripeCustomer {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeCustomerId String   @unique

  createdAt        DateTime @default(now())
}

model Product {
  id          String   @id @default(cuid())
  name        String
  description String?
  active      Boolean  @default(true)
  metadata    Json?    // arbitrary key-value pairs
  plans       Plan[]
  sortOrder   Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Plan {
  id              String   @id @default(cuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name            String   // "Monthly", "Yearly"
  stripePriceId   String   @unique
  priceInCents    Int      // 99 = $0.99
  currency        String   @default("usd")
  interval        String   // "month", "year", "one_time"
  intervalCount   Int      @default(1) // every N intervals
  trialDays       Int?     // optional trial period
  features        Json     // ["Feature A", "Feature B", ...]
  highlighted     Boolean  @default(false) // "Most popular" badge
  active          Boolean  @default(true)
  sortOrder       Int      @default(0)

  subscriptions   Subscription[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([productId])
}

model Subscription {
  id                     String             @id @default(cuid())
  userId                 String
  user                   User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  planId                 String
  plan                   Plan               @relation(fields: [planId], references: [id])
  stripeSubscriptionId   String             @unique
  status                 SubscriptionStatus
  currentPeriodStart     DateTime
  currentPeriodEnd       DateTime
  cancelAtPeriodEnd      Boolean            @default(false)
  canceledAt             DateTime?

  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  @@index([userId])
  @@index([stripeSubscriptionId])
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  TRIALING
  INCOMPLETE
  INCOMPLETE_EXPIRED
  PAUSED
}

// ─── Feature Flags (runtime, admin-managed) ───

// Business-level feature flags (NOT infrastructure toggles).
// Infrastructure (Stripe, Redis, RabbitMQ, etc.) is controlled by env vars at startup.
// These flags control UI/business behavior: maintenance mode, beta features, plan limits, etc.
model FeatureFlag {
  id          String   @id @default(cuid())
  key         String   @unique  // "maintenance_mode", "beta_signups", "max_free_games"
  enabled     Boolean  @default(false)
  value       Json?    // Optional typed payload: number, string, JSON object
                       // e.g. { "limit": 5 } for plan limits, "v2" for variant flags
  description String?

  updatedAt   DateTime @updatedAt
}

// ─── Audit Log ───

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?  // null for system actions
  action    String   // "user.login", "admin.impersonate", "subscription.cancel"
  target    String?  // target entity type + id
  metadata  Json?    // additional context
  ipAddress String?

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

### Migration Strategy

- Migrations are in `packages/db/prisma/migrations/`
- `pnpm db:migrate` runs `prisma migrate dev` (local) or `prisma migrate deploy` (CI/prod)
- Migrations run in CI **before** the API deploy step
- Seed script creates: default admin user, sample products/plans

---

## 9. Authentication

### Auth Flows

#### Email/Password Registration
```
1. User submits email + password
2. API validates, hashes password with argon2, creates User
3. API sends verification email (via Resend)
4. API returns JWT access token + sets httpOnly refresh token cookie
5. User clicks email link → API marks emailVerified = true
```

#### Email/Password Login
```
1. User submits email + password
2. API validates credentials via passport-local strategy
3. If 2FA is enabled for user:
   a. API returns partial token (2FA_REQUIRED status)
   b. Frontend redirects to /auth/two-factor
   c. User enters TOTP code (or backup code)
   d. API verifies, returns full JWT + refresh token
4. If 2FA not enabled:
   a. API returns JWT access token + sets httpOnly refresh token cookie
```

#### Google OAuth
```
1. User clicks "Continue with Google"
2. Frontend redirects to Google consent screen
3. Google redirects back with authorization code
4. API exchanges code for tokens, fetches user profile
5. API creates/links OAuthAccount, creates User if new
6. API returns JWT + refresh token
```

#### Passkey Registration
```
1. User navigates to /account/security, clicks "Add Passkey"
2. Frontend calls API → generateRegistrationOptions()
3. Browser prompts user for biometric/PIN
4. Frontend sends response to API → verifyRegistrationResponse()
5. API stores credential in Passkey table
```

#### Passkey Login
```
1. User clicks "Login with Passkey" on login page
2. Frontend calls API → generateAuthenticationOptions()
3. Browser prompts user for biometric/PIN
4. Frontend sends response to API → verifyAuthenticationResponse()
5. API validates, returns JWT + refresh token
   (2FA is skipped for passkey login — passkey IS the strong factor)
```

#### Password Reset
```
1. User submits email on /auth/forgot-password
2. API generates secure token, stores hash, sends email with reset link
3. User clicks link → /auth/reset-password?token=xxx
4. User enters new password
5. API validates token, hashes new password, invalidates all refresh tokens
```

### Token Strategy

| Token | Storage | Lifetime | Purpose |
|---|---|---|---|
| Access token (JWT) | Memory (frontend) | 15 minutes | API authorization |
| Refresh token | httpOnly cookie | 7 days | Silent refresh |
| 2FA partial token | Memory (frontend) | 5 minutes | Temporary, pre-2FA |

- **Refresh token rotation**: Each refresh issues a new refresh token and invalidates the old one.
- **Token family tracking**: If a revoked refresh token is reused (replay attack), all tokens in the family are revoked.
- **Redis session store** (when Redis enabled): Track active sessions, enable "logout everywhere."

---

## 10. Email System

### Architecture

```
NestJS API → EmailModule → Resend SDK → Resend API → User's inbox
                 ↓
         React Email templates (rendered to HTML string server-side)
```

### Templates

| Template | Trigger | Variables |
|---|---|---|
| `welcome.tsx` | User registration | `name`, `verifyUrl` |
| `verify-email.tsx` | Email verification resend | `name`, `verifyUrl` |
| `reset-password.tsx` | Password reset request | `name`, `resetUrl` |
| `two-factor-code.tsx` | 2FA code (if email-based 2FA added later) | `name`, `code` |
| `payment-confirmation.tsx` | Successful payment | `name`, `planName`, `amount` |
| `subscription-canceled.tsx` | Subscription canceled | `name`, `endDate` |

### React Email in a Non-React Project

React Email is used **only server-side** as a templating engine. It does not affect the frontend:

```typescript
// apps/api — email.service.ts
import { render } from '@react-email/render';
import { WelcomeEmail } from '@paisa/email-templates';
import { Resend } from 'resend';

const html = await render(WelcomeEmail({ name: 'Alice', verifyUrl: '...' }));
await this.resend.emails.send({
  from: 'hello@myapp.com',
  to: user.email,
  subject: 'Welcome to MyApp',
  html,
});
```

Dependencies: `react` and `react-dom` are **only** in the `packages/email-templates` package, isolated from the rest of the monorepo.

### Toggleable Behavior

When `features.email.enabled = false`:
- Auth still works (no verification emails sent, emailVerified defaults to true)
- Password reset returns success but sends no email (security: don't reveal email existence)
- Console logs what *would* have been sent (development convenience)

---

## 11. Payments — Stripe

### Architecture

```
Frontend                          API                              Stripe
────────                          ───                              ──────
User clicks "Subscribe"
  → POST /stripe/checkout    →   Create Checkout Session      →   Stripe Checkout page
                                                                      ↓
                              ←   Redirect to success URL      ←   Payment completed
                                                                      ↓
                                  Webhook: checkout.session.completed ←
                                  → Create/update Subscription record
                                  → Send confirmation email

User clicks "Manage Billing"
  → POST /stripe/portal      →   Create Portal Session        →   Stripe Customer Portal
                                                                   (plan change, cancel, payment method)
                                                                      ↓
                                  Webhook: customer.subscription.* ←
                                  → Update Subscription record
```

### Stripe Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Create Subscription record, link to user |
| `invoice.paid` | Confirm payment, extend subscription period |
| `invoice.payment_failed` | Mark subscription past_due, notify user |
| `customer.subscription.updated` | Sync plan changes, status transitions |
| `customer.subscription.deleted` | Mark subscription canceled, revoke access |

### Products & Plans in Database

Products and plans live in the database (managed via admin panel) AND are synced to Stripe:

- Admin creates a Product + Plan in the admin panel
- API creates the corresponding Stripe Product + Price via the API
- `stripePriceId` is stored on the Plan record
- Pricing page reads from the database (not from Stripe directly) — faster, cacheable
- Stripe is the source of truth for payment state; database is the source of truth for product catalog display

### Subscription Access Control

```typescript
// Decorator for subscription-gated endpoints
@UseGuards(SubscriptionGuard)
@RequiresSubscription({ product: 'flag-game', plans: ['pro'] })
@Get('hard-modes')
getHardModes() { ... }
```

### Toggleable Behavior

When `features.stripe.enabled = false`:
- No Stripe controllers registered
- No webhook endpoint
- `useStripe()` composable throws clear error if called
- Pricing page hidden (or shows "Coming soon")
- `@RequiresSubscription()` guard passes all requests (everything is free)

---

## 12. Caching — Redis

### Use Cases

| Use Case | Key Pattern | TTL |
|---|---|---|
| API response caching | `cache:endpoint:{path}:{hash}` | 5-60 min |
| Rate limiting | `throttle:{ip}:{endpoint}` | Per window |
| Session/refresh tokens | `session:{userId}:{tokenFamily}` | 7 days |
| 2FA challenges | `2fa:{userId}` | 5 min |
| WebAuthn challenges | `webauthn:{challenge}` | 5 min |
| Email verification tokens | `verify:{token}` | 24 hours |
| Password reset tokens | `reset:{token}` | 1 hour |

### NestJS Integration

```typescript
// Uses @nestjs/cache-manager with cache-manager v7 + cache-manager-redis-yet
CacheModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    store: redisStore,
    url: config.get('REDIS_URL'),
    ttl: 60_000, // default TTL in ms (cache-manager v7 uses ms)
  }),
  inject: [ConfigService],
});
```

### Toggleable Behavior

When `features.redis.enabled = false`:
- In-memory cache used as fallback (cache-manager's default memory store)
- Rate limiting uses in-memory store (less accurate in multi-process but functional)
- Token challenges stored in database instead of Redis
- WebSocket adapter uses local memory (no multi-server broadcast)

---

## 13. Message Queue — RabbitMQ

### Use Cases

| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| `email.send` | Auth module, Stripe module | Email consumer | Async email sending |
| `webhook.process` | Stripe webhook controller | Webhook consumer | Async webhook processing |
| `audit.log` | Any module | Audit consumer | Non-blocking audit logging |
| `notification.push` | Any module | Notification consumer | Push notifications, in-app notifications |

### Architecture

```
API (producer)
  → Publishes message to exchange
  → Returns response immediately (non-blocking)

Consumer (same NestJS app, different entry point OR same process)
  → Subscribes to queue
  → Processes message
  → Acks/Nacks with retry logic
  → Dead letter queue for failed messages
```

### Queue Observability (Admin)

The admin panel's queue page uses the **RabbitMQ Management HTTP API** (port 15672, exposed by the `rabbitmq:4-management` image):

```typescript
// modules/queue/queue-admin.service.ts
// Calls RabbitMQ Management API to provide admin visibility.
// Requires RABBITMQ_MANAGEMENT_URL + credentials (same guest/guest locally,
// configured via env vars in production).

@Injectable()
export class QueueAdminService {
  // GET /api/queues/{vhost} — list all queues with depth, rate, consumer count
  async listQueues(): Promise<QueueInfo[]> { ... }

  // POST /api/queues/{vhost}/{queue}/get — peek at messages (non-destructive with ackmode=reject_requeue_true)
  // Note: RabbitMQ management API uses POST for this endpoint (not GET) because it can alter queue state.
  async peekDeadLetters(queue: string, count: number): Promise<Message[]> { ... }

  // POST /api/exchanges/{vhost}/{exchange}/publish — republish a dead-lettered message
  async retryMessage(queue: string, messageId: string): Promise<void> { ... }
}
```

**Env vars required when RabbitMQ is enabled:**
- `RABBITMQ_URL` — AMQP connection (existing)
- `RABBITMQ_MANAGEMENT_URL` — HTTP management API (e.g., `http://rabbitmq.railway.internal:15672`)
- `RABBITMQ_MANAGEMENT_USER` / `RABBITMQ_MANAGEMENT_PASSWORD`

Admin endpoints (`/admin/queues/*`) are guarded by `@Roles('admin')` and delegate to `QueueAdminService`.

### NestJS Integration

Uses `@nestjs/microservices` with Transport.RMQ:

```typescript
// Producer side — inject ClientProxy
@Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy;

async sendWelcomeEmail(user: User) {
  this.client.emit('email.send', {
    template: 'welcome',
    to: user.email,
    data: { name: user.name },
  });
}
```

### Toggleable Behavior

When `features.rabbitmq.enabled = false`:
- Messages are processed **synchronously inline** instead of via queue
- `this.client.emit()` calls are replaced with direct service calls
- No consumer processes needed
- Slightly slower API responses (email sending blocks), but fully functional
- The `EventBus` abstraction wraps both patterns (see also [Architectural Invariant #2](#rule-2-optional-integrations-never-leak-into-core-domain) — core modules use `EventBus.emit()`, never direct queue/service imports):

```typescript
// common/event-bus.ts
// When RabbitMQ enabled: publishes to queue (async)
// When disabled: calls handler directly (sync inline)
// This is the ONLY way core modules should trigger optional side effects.
@Injectable()
export class EventBus {
  emit(event: string, data: any) {
    if (this.features.rabbitmq.enabled) {
      this.rmqClient.emit(event, data);
    } else {
      this.localHandler.handle(event, data);
    }
  }
}
```

---

## 14. File Storage — Cloudflare R2

### Architecture

```
Client                          API                         Cloudflare R2
──────                          ───                         ─────────────
Request upload URL
  → POST /storage/presign  →  Generate presigned PUT URL  →  (URL generated)
  ← Return presigned URL   ←

Upload directly to R2
  → PUT {presigned URL}    ─────────────────────────────→  File stored

Confirm upload
  → POST /storage/confirm  →  Verify file exists in R2
                           →  Store file metadata in DB
  ← Return file record     ←
```

### Why Presigned URLs?

- Files upload directly from browser to R2 — no API bandwidth usage
- API never handles large file data
- Works with any file size

### Node.js Integration

Uses `@aws-sdk/client-s3` (R2 is S3-compatible):

```typescript
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});
```

### Toggleable Behavior

When `features.storage.enabled = false` or `provider = 'local'`:
- Files stored on local disk (`./uploads/`)
- Served via Express static middleware
- Same API interface, different backend

---

## 15. WebSockets — Socket.io

### Architecture

```typescript
@WebSocketGateway({
  cors: { origin: [config.get('FRONTEND_URL'), config.get('ADMIN_URL')], credentials: true },
  namespace: '/ws',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    // Validate JWT from handshake auth
    // Join user-specific room: `user:{userId}`
  }

  // Emit to specific user from anywhere in the app:
  notifyUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
```

### Use Cases

- Real-time notifications (payment confirmed, email verified)
- Live admin dashboard updates
- Application-specific real-time features (game state, chat, etc.)

### Scaling

When Redis is enabled, use `@socket.io/redis-adapter` for multi-server broadcast:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
// Enables WebSocket events to propagate across multiple Railway instances
```

### Toggleable Behavior

When `features.websockets.enabled = false`:
- No WebSocket gateway registered
- `useSocket()` composable returns a no-op stub
- Real-time features degrade to polling or are hidden

---

## 16. Error Tracking — Sentry

### Backend (NestJS)

```typescript
// modules/sentry/sentry.module.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: config.sentry.dsn,
  environment: config.nodeEnv,
  tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
});

// Global filter catches unhandled exceptions and reports to Sentry
// Pino handles operational logging; Sentry handles error tracking
```

### Frontend (Nuxt)

```typescript
// Setup via @sentry/nuxt module + sentry.client.config.ts
Sentry.init({
  dsn: config.public.sentry.dsn,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### Toggleable Behavior

When `features.sentry.enabled = false`:
- Sentry SDK not initialized
- Errors still caught by global exception filter and logged via Pino
- No performance traces sent

---

## 17. Logging — Pino

### Configuration

```typescript
// core/logging/logging.module.ts
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined, // JSON in production
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
});
```

### Log Levels by Environment

| Environment | Level | Transport |
|---|---|---|
| Development | `debug` | pino-pretty (colored, human-readable) |
| Preview/Test | `info` | JSON (structured) |
| Production | `info` | JSON (structured) |

### What Gets Logged

- Every HTTP request/response (method, path, status, duration)
- Authentication events (login, logout, failed attempt, 2FA)
- Payment events (subscription created, payment failed)
- Queue events (message published, consumed, dead-lettered)
- Application errors (with stack traces)
- Sensitive fields redacted (authorization headers, cookies, passwords)

---

## 18. API Documentation — Scalar

### Setup

```typescript
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

const config = new DocumentBuilder()
  .setTitle('Paisa API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);

// Scalar UI at /api/docs
app.use('/api/docs', apiReference({
  spec: { content: document },
  theme: 'kepler',
}));

// Raw OpenAPI JSON at /api/docs/json
SwaggerModule.setup('api/swagger', app, document); // keep Swagger too if needed
```

### API Documentation Approach

- DTOs decorated with `@ApiProperty()` from `@nestjs/swagger`
- Controllers decorated with `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`
- Zod schemas generate OpenAPI types via `@anatine/zod-nestjs` or manual mapping
- Authentication documented with `@ApiBearerAuth()`
- Available at `/api/docs` in all environments

---

## 19. Branding System

### Brand Configuration

```typescript
// packages/config/brand.ts
export const brand = {
  // Identity
  name: 'My App',
  tagline: 'The best app ever',
  description: 'A short description for SEO and social sharing',

  // Assets (paths relative to public/)
  logo: '/logo.svg',
  logoDark: '/logo-dark.svg',  // optional dark mode variant
  favicon: '/favicon.ico',
  ogImage: '/og-image.png',    // social sharing preview

  // Theme — shadcn-vue uses OKLCH color space
  theme: {
    // Primary color drives the entire palette
    primary: 'oklch(0.637 0.237 25.331)',        // Customize this
    primaryForeground: 'oklch(0.971 0.013 17.38)',
    // All other shadcn-vue variables (secondary, accent, muted, etc.)
    // are derived or can be individually overridden
    radius: '0.625rem',  // Border radius for all components
  },

  // Typography
  fonts: {
    heading: 'Inter',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },

  // Links
  social: {
    twitter: '',
    github: '',
    discord: '',
  },

  // Legal
  company: 'My Company LLC',
  termsUrl: '/terms',
  privacyUrl: '/privacy',
};
```

### How Branding Flows Through the App

1. `brand.ts` exports the configuration
2. `tailwind.css` imports brand theme values as CSS custom properties
3. shadcn-vue components read CSS variables (no component code changes needed)
4. Layout components (`Navbar`, `Footer`) read `brand.name`, `brand.logo`
5. `<Head>` tags read `brand.name`, `brand.description`, `brand.ogImage`
6. Email templates read `brand.name`, `brand.logo`

**To rebrand:** Fork the boilerplate, edit `brand.ts`, replace logo files. Done.

---

## 20. Local Development

### Prerequisites

- Node.js 22 (enforced by `.nvmrc`)
- pnpm 10.x
- Docker + Docker Compose

### Docker Compose (Infrastructure Only)

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgres:17
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: paisa
      POSTGRES_PASSWORD: paisa
      POSTGRES_DB: paisa
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:4-management
    ports:
      - '5672:5672'    # AMQP
      - '15672:15672'  # Management UI (http://localhost:15672, guest/guest)
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### Development Commands

```bash
# First-time setup
pnpm install
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env
pnpm db:migrate     # Run Prisma migrations
pnpm db:seed        # Seed admin user + sample data

# Daily development
docker compose -f docker/docker-compose.yml up -d   # Start infra (if not running)
pnpm dev                                             # Start all apps in parallel

# This runs (via Turborepo):
#   apps/api    → http://localhost:3001  (NestJS + Scalar at /api/docs)
#   apps/web    → http://localhost:3000  (Nuxt customer app)
#   apps/admin  → http://localhost:3002  (Nuxt admin panel)

# Individual commands
pnpm dev --filter=api         # Only API
pnpm dev --filter=web         # Only frontend
pnpm build                    # Build everything
pnpm test                     # Run all tests
pnpm lint                     # Lint everything
pnpm typecheck                # TypeScript check everything
pnpm db:studio                # Open Prisma Studio (DB GUI)

# Stripe local testing
stripe listen --forward-to localhost:3001/stripe/webhook
```

### Environment Variables

```bash
# .env.example — All variables documented

# ─── Core (NestJS) ───
NODE_ENV=development
API_PORT=3001
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3002

# ─── Nuxt Runtime Config Overrides ───
# Nuxt 4 requires NUXT_PUBLIC_* env vars to override runtimeConfig.public at runtime.
# These are read by both apps/web and apps/admin.
NUXT_PUBLIC_API_BASE_URL=http://localhost:3001
NUXT_PUBLIC_SENTRY_DSN=

# ─── Database ───
DATABASE_URL=postgresql://paisa:paisa@localhost:5432/paisa

# ─── Auth ───
JWT_SECRET=your-dev-secret-min-32-chars-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
WEBAUTHN_RP_NAME=Paisa Dev
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000

# ─── Features (toggle on/off) ───
FEATURE_EMAIL_ENABLED=true
FEATURE_STRIPE_ENABLED=false
FEATURE_REDIS_ENABLED=true
FEATURE_RABBITMQ_ENABLED=false
FEATURE_STORAGE_ENABLED=false
FEATURE_WEBSOCKETS_ENABLED=false
FEATURE_SENTRY_ENABLED=false

# ─── Google OAuth (when enabled) ───
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# ─── Redis (when enabled) ───
REDIS_URL=redis://localhost:6379

# ─── RabbitMQ (when enabled) ───
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_MANAGEMENT_URL=http://localhost:15672
RABBITMQ_MANAGEMENT_USER=guest
RABBITMQ_MANAGEMENT_PASSWORD=guest

# ─── Stripe (when enabled) ───
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Resend (when enabled) ───
RESEND_API_KEY=re_...
EMAIL_FROM=dev@yourdomain.com

# ─── Cloudflare R2 (when enabled) ───
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=paisa-uploads
R2_PUBLIC_URL=

# ─── Sentry (when enabled) ───
# Used by NestJS directly; Nuxt reads NUXT_PUBLIC_SENTRY_DSN above
SENTRY_DSN=
```

---

## 21. Deployment — Dev → Test → Production

### Environment Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT                         │
│                                                                   │
│  Docker Compose: Postgres + Redis + RabbitMQ (localhost)          │
│  NestJS:  http://localhost:3001                                   │
│  Nuxt:    http://localhost:3000                                   │
│  Admin:   http://localhost:3002                                   │
│  Stripe:  stripe listen --forward-to localhost:3001               │
└─────────────────────────────────────────────────────────────────┘
                              │
                         git push (PR)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PREVIEW / TEST LINKS                       │
│                      (automatic per PR)                           │
│                                                                   │
│  Railway Preview (fully isolated per PR):                          │
│    API:      https://api-pr-{N}.up.railway.app                   │
│    Postgres: ephemeral DB per PR (auto-created, destroyed on close)│
│    Redis:    ephemeral instance per PR                             │
│    RabbitMQ: ephemeral instance per PR                             │
│                                                                   │
│  Vercel Preview:                                                  │
│    Web:      https://{app}-git-{branch}-{user}.vercel.app        │
│    Admin:    https://{admin}-git-{branch}-{user}.vercel.app      │
│                                                                   │
│  GitHub Actions:                                                  │
│    ✓ Lint    ✓ Typecheck    ✓ Unit tests    ✓ E2E tests          │
│                                                                   │
│  → PR comment with all preview links + test results               │
└─────────────────────────────────────────────────────────────────┘
                              │
                         merge to main
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                              │
│                                                                   │
│  Railway Production:                                              │
│    API:      https://api.myapp.com                               │
│    Postgres: production DB (Railway managed)                      │
│    Redis:    production instance (Railway managed)                │
│    RabbitMQ: production instance (Railway Docker)                 │
│                                                                   │
│  Vercel Production:                                               │
│    Web:      https://myapp.com                                   │
│    Admin:    https://admin.myapp.com                             │
│                                                                   │
│  External:                                                        │
│    Stripe:   live mode                                            │
│    Resend:   verified production domain                           │
│    Sentry:   production project                                   │
│    R2:       production bucket                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Test Links Flow (per PR)

When you push a branch and open a PR:

1. **Vercel** (automatic — GitHub integration):
   - Detects changes in `apps/web/` → deploys preview
   - Detects changes in `apps/admin/` → deploys preview
   - Preview URL appears as PR comment within ~2 minutes
   - Uses `PREVIEW` environment variables from Vercel dashboard

2. **Railway** (automatic — GitHub integration):
   - Detects changes → spins up an **isolated preview environment** per PR
   - Each preview gets its own API instance, Postgres, Redis, and RabbitMQ
   - Railway preview environments clone the service graph — each PR gets ephemeral infrastructure that is torn down when the PR is closed/merged
   - Migrations run automatically against the ephemeral DB on deploy
   - No shared state between PRs — one branch's migrations cannot break another
   - Preview URL appears in Railway dashboard

3. **GitHub Actions** (automatic):
   - Runs on every push to a PR branch
   - Lint → Typecheck → Unit tests → E2E tests (Playwright against preview URLs)
   - Posts results as PR check status

4. **PR Comment** (via GitHub Actions):
   ```
   🔗 Preview Links:
   • Frontend: https://my-app-git-feature-x.vercel.app
   • Admin:    https://my-admin-git-feature-x.vercel.app
   • API:      https://api-pr-42.up.railway.app
   • API Docs: https://api-pr-42.up.railway.app/api/docs

   ✅ All checks passed
   ```

### New App Setup (from boilerplate to deployed)

```bash
# 1. Fork the boilerplate
gh repo create my-new-app --template your-username/paisa
cd my-new-app
pnpm install

# 2. Configure branding
#    Edit: packages/config/brand.ts (name, colors, logo)
#    Replace: apps/web/public/logo.svg, favicon.ico

# 3. Configure features
#    Edit: .env (toggle features on/off)

# 4. Railway setup (one-time, ~5 min)
railway login
railway init                     # Creates project
railway add --plugin postgresql  # Adds managed Postgres
railway add --plugin redis       # Adds managed Redis (if needed)
# Add RabbitMQ as Docker service via Railway dashboard (if needed)
# Connect GitHub repo for auto-deploy

# 5. Vercel setup (one-time, ~2 min)
vercel link                      # Link apps/web
# In Vercel dashboard: set environment variables, set root directory to apps/web
# Repeat for apps/admin with separate Vercel project

# 6. Configure secrets
# Railway dashboard: add env vars (STRIPE_SECRET_KEY, RESEND_API_KEY, etc.)
# Vercel dashboard: add env vars (NUXT_PUBLIC_API_BASE_URL pointing to Railway, etc.)

# 7. Deploy
git push origin main             # Triggers auto-deploy everywhere

# 8. Verify
# Railway: API is live at assigned URL
# Vercel: Frontend is live at assigned URL
# Configure custom domains if desired
```

---

## 22. CI/CD — GitHub Actions

### Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # Turborepo runs these in the correct order based on dependency graph
      # Remote caching via TURBO_TOKEN + TURBO_TEAM for fast CI
      - run: pnpm turbo run lint typecheck build test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

  e2e:
    runs-on: ubuntu-latest
    needs: ci
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm turbo run build

      # Run migrations against the CI database
      - run: pnpm turbo run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      # Start the API server in the background
      - run: pnpm --filter=api start &
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          API_PORT: 3001
          NODE_ENV: test

      # Wait for API to be ready
      - run: npx wait-on http://localhost:3001/health --timeout 30000

      # Start the Nuxt frontend in preview mode in the background
      # Nuxt preview uses PORT (not NUXT_PORT) for --port override
      # Runtime config overrides use NUXT_PUBLIC_* prefix
      - run: pnpm --filter=web preview &
        env:
          NUXT_PUBLIC_API_BASE_URL: http://localhost:3001
          PORT: 3000

      # Start the admin panel in preview mode in the background
      - run: pnpm --filter=admin preview &
        env:
          NUXT_PUBLIC_API_BASE_URL: http://localhost:3001
          PORT: 3002

      # Wait for all servers to be ready
      - run: npx wait-on http://localhost:3000 http://localhost:3002 --timeout 30000

      # Run Playwright tests against local servers
      - run: pnpm turbo run test:e2e
        env:
          API_BASE_URL: http://localhost:3001
          FRONTEND_URL: http://localhost:3000
          ADMIN_URL: http://localhost:3002
          DATABASE_URL: postgresql://test:test@localhost:5432/test
```

### Deployment Workflows

```yaml
# .github/workflows/deploy-api.yml — Railway auto-deploys from GitHub integration
# No manual workflow needed. Railway watches the main branch.

# Vercel auto-deploys via GitHub integration.
# No manual workflow needed. Vercel watches the main branch.
```

For both Railway and Vercel: connect the GitHub repo in their respective dashboards. Push to main = production deploy. Push to PR branch = preview deploy. Zero workflow config for deploys.

### Turborepo Task Pipeline

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**", "dist/**", ".nuxt/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "test:e2e": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    }
  }
}
```

---

## 23. Testing Strategy

### Test Types

| Type | Tool | Location | What It Tests |
|---|---|---|---|
| Unit (backend) | Vitest | `apps/api/src/**/*.spec.ts` | Services, guards, pipes in isolation |
| Unit (frontend) | Vitest | `apps/web/app/**/*.spec.ts` | Composables, utility functions |
| Component (frontend) | Vitest + Vue Test Utils | `apps/web/app/**/*.spec.ts` | Vue components, rendering, interactions |
| Integration (backend) | Vitest | `apps/api/test/e2e/*.spec.ts` | API endpoints with real DB |
| E2E | Playwright | `tests/e2e/` (root level) | Full user flows through browser |

### What's Tested End-to-End

| Flow | Steps |
|---|---|
| Registration | Fill form → Submit → Check DB → Receive email → Click verify link → Email verified |
| Login | Fill form → Submit → Receive JWT → Access protected route |
| Google OAuth | Click Google → Mock OAuth → User created → JWT issued |
| Passkey | Register passkey → Login with passkey → Access granted |
| 2FA | Enable 2FA → Logout → Login → Enter TOTP → Access granted |
| Password Reset | Request reset → Receive email → Click link → Set new password → Login with new password |
| Subscription | View pricing → Click subscribe → Stripe checkout (test mode) → Webhook fires → Access granted |
| Admin | Login as admin → View users → Impersonate user → Return to admin |

### Test Utilities

```typescript
// test/helpers/factory.ts — Test data factories
const user = await createTestUser({ role: 'ADMIN', emailVerified: true });
const plan = await createTestPlan({ priceInCents: 99, interval: 'month' });
const subscription = await createTestSubscription({ userId: user.id, planId: plan.id });

// test/helpers/auth.ts — Auth helpers
const { accessToken } = await loginAs(user);
const response = await api.get('/protected').set('Authorization', `Bearer ${accessToken}`);
```

---

## 24. Security

### Authentication Security

- **Password hashing**: Argon2id (memory-hard, GPU-resistant)
- **JWT**: Short-lived access tokens (15 min), httpOnly refresh cookies
- **Refresh token rotation**: New token per refresh, family-based revocation
- **Cookie policy (environment-aware)**:
  - **Production**: `SameSite=Lax; Secure; HttpOnly` — frontend and API share a common domain (e.g., `myapp.com` and `api.myapp.com`), so cookies flow naturally. CSRF token required for state-changing requests as defense-in-depth.
  - **Preview/PR environments**: Frontend (`*.vercel.app`) and API (`*.railway.app`) are cross-site. Cookies use `SameSite=None; Secure; HttpOnly` so the browser sends them cross-origin. CORS is restricted to the specific preview origin. A per-request CSRF token (double-submit pattern) is **required** for all state-changing operations in this mode.
  - **Local development**: `SameSite=Lax` (same localhost origin, no cross-site issues).
  - The cookie `sameSite` value is derived from `NODE_ENV` and the `FRONTEND_URL` / `API_BASE_URL` env vars at startup — not hardcoded.
- **Account lockout**: After 5 failed login attempts, lock for 15 minutes (tracked in Redis or DB)

### API Security

- **CORS**: Strict origin whitelist (`FRONTEND_URL`, `ADMIN_URL`)
- **Helmet**: Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- **Rate limiting**: Redis-backed throttler (see section 25)
- **Input validation**: Zod schemas on all endpoints
- **SQL injection**: Prisma ORM (parameterized queries)
- **XSS**: Nuxt auto-escapes template output; API response Content-Type: application/json

### Sensitive Data

- **Secrets in env vars only** — never in code or config files
- **Password hashes**: Argon2id, never logged or exposed via API
- **TOTP secrets**: Encrypted at rest in database
- **Refresh tokens**: Only hash stored in DB, raw token in httpOnly cookie
- **Backup codes**: Hashed with Argon2, displayed once during 2FA setup
- **Stripe webhook verification**: `constructEvent()` with webhook secret
- **Pino redaction**: Authorization headers, cookies, passwords stripped from logs

### Infrastructure Security

- **Railway**: Private networking between services (no public DB/Redis/RabbitMQ endpoints)
- **Vercel**: Automatic HTTPS, DDoS protection
- **Database**: Connection via internal Railway URL (not exposed to internet)
- **Admin panel**: Separate deployment, admin role guard, audit logging

---

## 25. Rate Limiting

### Configuration

```typescript
// Uses @nestjs/throttler with Redis storage
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'short', ttl: 1_000, limit: 3 },    // 3 requests per second
    { name: 'medium', ttl: 10_000, limit: 20 },  // 20 requests per 10 seconds
    { name: 'long', ttl: 60_000, limit: 100 },   // 100 requests per minute
  ],
  storage: features.redis.enabled
    ? new ThrottlerStorageRedisService(redisClient)
    : undefined, // falls back to in-memory
});
```

### Endpoint-Specific Limits

| Endpoint | Limit | Why |
|---|---|---|
| `POST /auth/login` | 5/min per IP | Brute force prevention |
| `POST /auth/register` | 3/min per IP | Abuse prevention |
| `POST /auth/forgot-password` | 3/min per IP | Email spam prevention |
| `POST /auth/two-factor/verify` | 5/min per user | TOTP brute force prevention |
| `POST /stripe/webhook` | No limit | Stripe's own security; not user-facing |
| All other endpoints | 100/min per user | General abuse prevention |

---

## 26. Marketing & Pricing Pages

### Marketing Landing Page

Pre-built at `/` with the `marketing` layout. Sections (all using shadcn-vue components):

- **Hero**: Headline, subheadline, CTA buttons (configurable via `brand.ts`)
- **Features**: Grid of feature cards (content in a simple JSON/config)
- **Pricing**: Dynamic pricing table from API (see below)
- **Testimonials**: Carousel (content in config or CMS)
- **FAQ**: Accordion (content in config)
- **Footer**: Links, social icons, legal links

All marketing content is easily editable — either in config files or (later) via a CMS integration.

### Dynamic Pricing Page

The pricing page at `/pricing` reads plans from the API:

```
GET /plans?active=true

Response:
{
  "data": [
    {
      "id": "...",
      "product": { "name": "Flag Game", "description": "..." },
      "name": "Monthly",
      "priceInCents": 99,
      "currency": "usd",
      "interval": "month",
      "features": ["Hard modes", "No ads", "Leaderboards"],
      "highlighted": true
    },
    ...
  ]
}
```

The frontend renders a `PricingTable` component:
- Cards for each plan with feature list
- "Most popular" badge on `highlighted` plans
- Monthly/Yearly toggle (filters by interval)
- CTA button → redirects to Stripe Checkout (or login first if not authenticated)

**Admin manages plans**: Admin panel → Products → Create/edit plans → Syncs to Stripe.
**Pricing page auto-updates**: No code changes needed to add/modify plans.

---

## 27. Architectural Invariants

These are non-negotiable rules enforced through code review, linting, and testing. They exist to prevent the architecture from drifting as features are added.

### Rule 1: Infrastructure Flags and Business Flags Are Permanently Separate

Two completely distinct systems. Never mix them.

| | Infrastructure Flags | Business Flags |
|---|---|---|
| **Where defined** | `packages/config/features.ts` | `FeatureFlag` table in database |
| **When evaluated** | App startup (bootstrap) | Runtime (per-request) |
| **Changed by** | Env var change + redeploy | Admin panel UI (instant) |
| **Controls** | Module loading, providers, controllers, Nuxt plugins | UI visibility, plan limits, beta gates, maintenance mode |
| **Examples** | `FEATURE_STRIPE_ENABLED`, `FEATURE_REDIS_ENABLED` | `maintenance_mode`, `max_free_games`, `beta_signups` |

**Enforcement**: The `FeatureFlag` table key column has a CHECK constraint (or Zod validation in the admin API) that rejects keys matching infrastructure names (`stripe`, `redis`, `rabbitmq`, `sentry`, `storage`, `websockets`). This makes accidental crossover a hard error, not a convention.

### Rule 2: Optional Integrations Never Leak Into Core Domain

Core domain modules (`auth`, `user`, `database`, `config`, `health`) must **never** import from optional modules (`stripe`, `queue`, `cache`, `storage`, `websocket`, `sentry`, `email`).

The dependency direction is always: `optional module → core`, never `core → optional module`.

When a core flow needs to trigger an optional behavior (e.g., auth registration needs to send a welcome email), it uses the **EventBus abstraction**:

```typescript
// CORRECT: Core emits a domain event, optional module listens
// auth.service.ts (core)
await this.eventBus.emit('user.registered', { userId: user.id });

// email.listener.ts (optional — only registered when email is enabled)
@OnEvent('user.registered')
async handleUserRegistered(payload: { userId: string }) {
  await this.emailService.sendWelcome(payload.userId);
}

// WRONG: Core directly imports optional module
// auth.service.ts
import { EmailService } from '../email/email.service'; // ❌ NEVER
```

**Enforcement**: ESLint rule (`no-restricted-imports`) blocks `apps/api/src/core/**` and `apps/api/src/modules/auth/**` from importing anything under `apps/api/src/modules/{stripe,queue,cache,storage,websocket,sentry,email}/**`.

### Rule 3: Queue and Admin Features Stay Optional

The admin panel and RabbitMQ queue system are convenience layers. The core app must function identically without them:

- **No admin-only data**: Every piece of data the admin panel shows is accessible via standard API endpoints (with admin role guard). The admin app is just a UI — not a data source.
- **No queue-only workflows**: Every workflow that uses RabbitMQ has a synchronous fallback via the EventBus. The `EventBus.emit()` pattern (section 13) handles this automatically. If RabbitMQ is disabled, the handler runs inline. No code changes needed.
- **Queue admin endpoints are fully guarded**: `/admin/queues/*` routes return `404` (not `403`) when RabbitMQ is disabled, as if they don't exist. The controller is simply not registered.

**Enforcement**: CI runs the full test suite with `FEATURE_RABBITMQ_ENABLED=false` as a separate matrix job, ensuring no hidden queue dependency breaks the happy path.

### Rule 4: `useFeatures()` Has a Single, Documented Source and Refresh Strategy

The frontend `useFeatures()` composable serves two kinds of flags from two sources. This must remain explicit:

```typescript
// composables/useFeatures.ts
export function useFeatures() {
  // ── Infrastructure flags (static, from build/runtime config) ──
  // These come from Nuxt runtimeConfig, set at build time or via NUXT_PUBLIC_* env vars.
  // They NEVER change during a user session. No refresh needed.
  const { features: infraFlags } = useRuntimeConfig().public;

  // ── Business flags (dynamic, from API) ──
  // Fetched once on app init, cached in Pinia, refreshable.
  const businessFlagStore = useBusinessFlagStore();

  // Refresh business flags (called on app init + optionally on focus/interval)
  async function refreshBusinessFlags() {
    const { data } = await useApi().$api<FeatureFlag[]>('/features');
    if (data.value) businessFlagStore.setFlags(data.value);
  }

  return {
    // Infrastructure (static)
    stripe: infraFlags.stripe,
    websockets: infraFlags.websockets,
    auth: infraFlags.auth,

    // Business (dynamic)
    businessFlags: businessFlagStore.flags,
    getFlag: businessFlagStore.getFlag,     // getFlag('max_free_games') → { enabled: true, value: { limit: 5 } }
    isEnabled: businessFlagStore.isEnabled, // isEnabled('maintenance_mode') → boolean

    // Refresh
    refreshBusinessFlags,
  };
}
```

**Refresh strategy**:
- Business flags are fetched **once** during app initialization (`app.vue` or a Nuxt plugin).
- Optionally refreshed on `window focus` (user returns to tab) via `useEventListener('focus', ...)`.
- **Not** polled on an interval — that adds unnecessary load. If real-time flag changes are needed, the WebSocket gateway pushes a `flags.updated` event and the composable reacts.
- The Pinia store provides the single source of truth. Components never fetch flags directly.

**Enforcement**: ESLint rule ensures components use `useFeatures()` and never call the `/features` endpoint directly or read `useRuntimeConfig().public.features` outside this composable.

---

## 28. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Monorepo running, database connected, basic API with health check.

- [ ] Initialize Turborepo + pnpm workspaces
- [ ] Create `packages/config` with Zod env validation + feature flags
- [ ] Create `packages/shared` with base types
- [ ] Create `packages/db` with Prisma schema (all models), initial migration, seed script
- [ ] Create `apps/api` — NestJS 11 app with SWC, Vitest
  - [ ] CoreConfigModule (typed env config)
  - [ ] DatabaseModule (Prisma integration)
  - [ ] LoggingModule (Pino)
  - [ ] HealthModule (DB check, uptime)
  - [ ] Scalar API docs at `/api/docs`
  - [ ] Global exception filter, response interceptor, Zod validation pipe
- [ ] Create `docker/docker-compose.yml` (Postgres, Redis, RabbitMQ)
- [ ] Create `.env.example` with all variables
- [ ] Verify: `docker compose up && pnpm dev` → API at localhost:3001, docs at /api/docs

### Phase 2: Authentication (Week 2)

**Goal**: Full auth system — register, login, JWT, refresh tokens, email verification, password reset.

- [ ] AuthModule: passport-local strategy, passport-jwt strategy
- [ ] UserModule: CRUD, profile
- [ ] Register endpoint: create user, hash password (argon2), send verification email
- [ ] Login endpoint: validate credentials, issue JWT + refresh token
- [ ] Refresh token rotation with family tracking
- [ ] Email verification flow (token in Redis/DB, verify endpoint)
- [ ] Password reset flow (token, email, reset endpoint, invalidate sessions)
- [ ] Guards: JwtAuthGuard, RolesGuard
- [ ] Decorators: @CurrentUser, @Public, @Roles

### Phase 3: Auth Extended (Week 3)

**Goal**: Google OAuth, passkeys, 2FA.

- [ ] Google OAuth: passport-google-oauth20, callback, account linking
- [ ] Passkey registration + authentication (SimpleWebAuthn)
- [ ] 2FA: TOTP setup, QR code generation, verification, backup codes
- [ ] TwoFactorGuard: intercept login flow when 2FA enabled
- [ ] Account lockout after failed attempts

### Phase 4: Email System (Week 3-4)

**Goal**: Resend integration, React Email templates, async sending.

- [ ] Create `packages/email-templates` with React Email
- [ ] Build all templates: welcome, verify, reset, payment confirmation
- [ ] EmailModule: Resend integration, render + send
- [ ] Toggleable: log-only mode when disabled

### Phase 5: Frontend Shell (Week 4-5)

**Goal**: Nuxt 4 app with auth pages, layouts, branding.

- [ ] Create `apps/web` — Nuxt 4 with shadcn-vue, Tailwind CSS 4
- [ ] Create `packages/config/brand.ts` branding system
- [ ] Set up theming (CSS variables from brand config)
- [ ] Layouts: `default`, `auth`, `marketing`
- [ ] Composables: `useAuth`, `useApi`, `useFeatures`
- [ ] Auth pages: login, register, forgot-password, reset-password, verify-email, two-factor
- [ ] Account pages: profile settings, security (password, passkeys, 2FA), billing
- [ ] Route middleware: `auth`, `guest`
- [ ] Marketing layout shell

### Phase 6: Payments (Week 5-6)

**Goal**: Stripe integration, subscription management, pricing page.

- [ ] StripeModule: customer creation, checkout sessions, portal sessions
- [ ] Webhook controller: handle all subscription lifecycle events
- [ ] Admin endpoints: product/plan CRUD, sync to Stripe
- [ ] SubscriptionGuard + @RequiresSubscription decorator
- [ ] Frontend: pricing page (dynamic from API), checkout flow, billing management
- [ ] Toggleable: guard passes all when disabled

### Phase 7: Admin Panel (Week 6-7)

**Goal**: Admin backoffice with user management, product management, system overview.

- [ ] Create `apps/admin` — Nuxt 4 with shared shadcn-vue setup
- [ ] Dashboard: stats overview
- [ ] User management: list, detail, ban, impersonate
- [ ] Product & plan management: CRUD, Stripe sync
- [ ] Email template preview
- [ ] Feature flags management
- [ ] System health page

### Phase 8: Integrations (Week 7-8)

**Goal**: Redis caching, RabbitMQ, file storage, WebSockets, Sentry.

- [ ] CacheModule: Redis via cache-manager v7
- [ ] QueueModule: RabbitMQ with EventBus abstraction
- [ ] StorageModule: Cloudflare R2 with presigned URLs
- [ ] WebsocketModule: Socket.io gateway, auth handshake, user rooms
- [ ] SentryModule: backend + frontend integration
- [ ] Rate limiting: ThrottlerModule with Redis storage
- [ ] All toggleable with graceful fallbacks

### Phase 9: Marketing & Polish (Week 8-9)

**Goal**: Marketing page, deployment pipeline, documentation.

- [ ] Marketing landing page: hero, features, pricing, FAQ, footer
- [ ] SEO: meta tags, og:image, sitemap
- [ ] Dockerfile for API
- [ ] Railway deployment config
- [ ] Vercel project configuration (web + admin)
- [ ] GitHub Actions CI/CD pipeline
- [ ] Turborepo remote caching setup
- [ ] README with complete setup instructions

### Phase 10: Testing & Hardening (Week 9-10)

**Goal**: Comprehensive test coverage, security audit.

- [ ] Unit tests: auth service, stripe service, guards, pipes
- [ ] Integration tests: all API endpoints with real DB
- [ ] E2E tests (Playwright): all auth flows, payment flow, admin flow
- [ ] Test factories and helpers
- [ ] Security review: CORS, CSRF, rate limiting, input validation
- [ ] Audit logging for admin actions
- [ ] Performance: response times, query optimization
- [ ] Load testing basics

---

## Appendix A: Package Dependencies

### apps/api

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/cache-manager": "^3.0.0",
    "@nestjs/throttler": "^6.0.0",
    "@nestjs/websockets": "^11.0.0",
    "@nestjs/platform-socket.io": "^11.0.0",
    "@nestjs/microservices": "^11.0.0",
    "@scalar/nestjs-api-reference": "^1.0.0",
    "@simplewebauthn/server": "^11.0.0",
    "@sentry/nestjs": "^10.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/s3-request-presigner": "^3.0.0",
    "@prisma/client": "^7.0.0",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "passport-jwt": "^4.0.0",
    "passport-google-oauth20": "^2.0.0",
    "argon2": "^0.41.0",
    "otpauth": "^9.0.0",
    "stripe": "^15.0.0",
    "resend": "^4.0.0",
    "cache-manager": "^7.0.0",
    "cache-manager-redis-yet": "^5.0.0",
    "nestjs-pino": "^4.0.0",
    "pino-pretty": "^11.0.0",
    "zod": "^3.0.0",
    "rxjs": "^7.0.0",
    "reflect-metadata": "^0.2.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@swc/core": "^1.0.0",
    "vitest": "^3.0.0",
    "prisma": "^7.0.0",
    "typescript": "^5.0.0"
  }
}
```

### apps/web & apps/admin

```json
{
  "dependencies": {
    "nuxt": "^4.0.0",
    "shadcn-nuxt": "^2.5.0",
    "shadcn-vue": "^2.5.0",
    "@pinia/nuxt": "^0.11.0",
    "@sentry/nuxt": "^10.0.0",
    "@simplewebauthn/browser": "^11.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@nuxt/test-utils": "^3.0.0",
    "vitest": "^3.0.0",
    "playwright": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Appendix B: Decision Log

| Decision | Choice | Alternatives Considered | Rationale |
|---|---|---|---|
| Monorepo tool | Turborepo + pnpm workspaces | Nx, Lerna | Simpler, Vercel-native, sufficient for 3 apps + 3 packages |
| ORM | Prisma 7 | Drizzle, TypeORM | Best DX, type-safety, migration tooling, largest community |
| API framework | NestJS 11 | Fastify standalone, Express | Best structure for large apps, modules, decorators, guards, official integrations |
| Frontend | Nuxt 4 | Next.js, SvelteKit | Vue ecosystem preference, SSR, file-based routing, auto-imports |
| UI components | shadcn-vue | Nuxt UI, Vuetify, PrimeVue | Beautiful defaults, full source ownership, OKLCH theming, active community |
| API docs | Scalar | Swagger UI, Redoc, Stoplight | Modern UX, actively maintained, NestJS integration package |
| Auth | Custom (Passport + SimpleWebAuthn) | Better Auth, Lucia, Auth0, Clerk | Full control, no vendor lock-in, no per-user cost, supports all 4 auth methods |
| Email | Resend + React Email | SendGrid, Postmark, Nodemailer | Best DX, React Email templates, generous free tier |
| Password hashing | Argon2id | bcrypt, scrypt | Memory-hard (GPU-resistant), OWASP recommended, winner of PHC |
| File storage | Cloudflare R2 | AWS S3, Vercel Blob | S3-compatible, zero egress fees, generous free tier |
| Logging | Pino | Winston, Bunyan | Fastest Node.js logger, structured JSON, nestjs-pino integration |
| API hosting | Railway | Fly.io, Render, AWS ECS | Simple UX, Docker support, managed DB/Redis plugins, preview environments, GitHub integration |
| Frontend hosting | Vercel | Netlify, Cloudflare Pages | Best Nuxt SSR support, preview deploys, edge network |
| Cache | Redis (cache-manager v7) | Memcached, in-memory only | Industry standard, multiple use cases (cache, sessions, rate limiting, pub/sub) |
| Message queue | RabbitMQ | Redis Streams, BullMQ, Kafka | Mature, reliable, dead letter queues, management UI, right size for this use case |
| Testing | Vitest + Playwright | Jest + Cypress | Vitest is NestJS 11 default, fastest; Playwright is more reliable and faster than Cypress |
| CI/CD | GitHub Actions | CircleCI, GitLab CI | Native GitHub integration, free for public repos, sufficient for this use case |
| Validation | Zod | class-validator, Joi | Works on both frontend and backend, TypeScript-first, shared schemas |

---

## Appendix C: Cost Estimate (Per Project)

### Free Tier (Development / Side Project)

| Service | Free Tier | Monthly Cost |
|---|---|---|
| Railway (Hobby) | $5 credit | ~$5 (API + Postgres + Redis) |
| Vercel (Hobby) | Unlimited previews | $0 |
| Cloudflare R2 | 10GB storage | $0 |
| Resend | 3,000 emails/mo | $0 |
| Sentry | 5,000 errors/mo | $0 |
| Stripe | Pay-as-you-go | 2.9% + $0.30 per transaction |
| GitHub Actions | 2,000 min/mo | $0 |
| **Total** | | **~$5/mo + Stripe fees** |

### Growth (Real Users)

| Service | Tier | Monthly Cost |
|---|---|---|
| Railway (Pro) | Team plan | ~$20-50 |
| Vercel (Pro) | Team plan | $20 |
| Cloudflare R2 | Usage-based | ~$1-5 |
| Resend | 50k emails | $20 |
| Sentry (Team) | 50k errors | $26 |
| **Total** | | **~$90-120/mo + Stripe fees** |
