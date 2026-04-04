# Fork and Deploy in 5 Minutes

This guide gets you from fork to live production app.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- A PostgreSQL database (e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com), or any managed Postgres)
- A hosting platform for Docker containers (e.g., [Railway](https://railway.app), [Fly.io](https://fly.io), [Render](https://render.com))

## Step 1: Fork and Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/paisa.git
cd paisa
```

## Step 2: Rebrand

Edit `packages/config/src/brand.ts`:

```typescript
export const brand = {
  name: 'YourApp',
  tagline: 'Your tagline here',
  description: 'Your app description',
  // ... update logo paths, colors, company name
};
```

Replace the logo files in `apps/web/public/`.

## Step 3: Set Up Environment Variables

Copy the example and fill in your values:

```bash
cp .env .env.production
```

**Required for production:**

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Auth
JWT_SECRET=generate-a-random-64-char-string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# URLs (replace with your actual domains)
API_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
API_PORT=3001

# WebAuthn (passkeys)
WEBAUTHN_RP_NAME=YourApp
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_ORIGIN=https://yourdomain.com

# Email (Resend)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

**Optional (enable as needed):**

```env
# Google OAuth
FEATURE_AUTH_GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback

# Stripe Payments
FEATURE_STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Redis (recommended for multi-server)
FEATURE_REDIS_ENABLED=true
REDIS_URL=redis://host:6379

# Storage (Cloudflare R2 for production)
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=your-bucket
R2_PUBLIC_URL=https://cdn.yourdomain.com

# Error tracking
FEATURE_SENTRY_ENABLED=true
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Step 4: Deploy

### Option A: Docker (recommended)

Build and push the images:

```bash
# Build
docker build -f docker/Dockerfile.api -t paisa-api .
docker build -f docker/Dockerfile.web -t paisa-web .

# Tag and push to your registry
docker tag paisa-api your-registry/paisa-api:latest
docker tag paisa-web your-registry/paisa-web:latest
docker push your-registry/paisa-api:latest
docker push your-registry/paisa-web:latest
```

The API image automatically runs database migrations on startup.

**Ports:**
- API: `3001`
- Web: `3000`

**Health check:** `GET /health` on the API.

### Option B: Railway

1. Connect your GitHub repo to Railway
2. Create two services from the same repo:
   - **API**: Set Dockerfile path to `docker/Dockerfile.api`, port `3001`
   - **Web**: Set Dockerfile path to `docker/Dockerfile.web`, port `3000`
3. Add a PostgreSQL database from the Railway marketplace
4. Set environment variables in the Railway dashboard
5. Deploy

### Option C: Fly.io

```bash
# API
fly launch --dockerfile docker/Dockerfile.api --name yourapp-api
fly secrets set DATABASE_URL=xxx JWT_SECRET=xxx ...

# Web
fly launch --dockerfile docker/Dockerfile.web --name yourapp-web
fly secrets set NUXT_PUBLIC_API_BASE_URL=https://yourapp-api.fly.dev
```

## Step 5: Post-Deploy Checklist

- [ ] Hit `https://api.yourdomain.com/health` — should return `{ status: "ok" }`
- [ ] Open `https://yourdomain.com` — app loads
- [ ] Register an account — verify email flow works
- [ ] Check `https://api.yourdomain.com/api/docs` — API docs load
- [ ] If Stripe: create products in Stripe Dashboard, run seed, test checkout
- [ ] If Google OAuth: add production origins/redirects in Google Console
- [ ] Set up a Stripe webhook pointing to `https://api.yourdomain.com/stripe/webhooks`

## CI/CD

The repo includes a GitHub Actions pipeline (`.github/workflows/ci.yml`) that runs on every push and PR:

- TypeScript type checking (API + Web)
- Unit tests
- API e2e tests (with Postgres service)
- Playwright browser tests
- Docker build verification

## Generating Secrets

```bash
# JWT secret (64 random characters)
openssl rand -hex 32

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web App   │────▶│   API       │────▶│  PostgreSQL  │
│  (Nuxt SPA) │     │  (NestJS)   │     │             │
│  port 3000  │     │  port 3001  │     │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Redis     │  (optional)
                    │  (tokens,   │
                    │  challenges)│
                    └─────────────┘
```

Both apps are stateless and can scale horizontally. Enable Redis for multi-instance deployments.
