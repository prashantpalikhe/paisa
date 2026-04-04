# Deploy to Railway

This guide gets you from fork to live production app on [Railway](https://railway.app).

Railway builds your Docker images, runs them, gives you URLs, and auto-deploys on every push. When you're ready, you can add your own custom domain.

## Prerequisites

- A [Railway](https://railway.app) account (free tier available)
- Your fork of this repo on GitHub

## Step 1: Fork, Clone, and Rebrand

```bash
git clone https://github.com/YOUR_USERNAME/paisa.git
cd paisa
```

Edit `packages/config/src/brand.ts` to change the app name, tagline, colors, etc. Replace logo files in `apps/web/public/`.

## Step 2: Create Railway Services

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo
3. Create **three services** from the same repo:

| Service | Dockerfile Path | Port |
|---------|----------------|------|
| API | `docker/Dockerfile.api` | `3001` |
| Web | `docker/Dockerfile.web` | `3000` |
| PostgreSQL | Add from Railway marketplace (one click) | — |

Railway assigns each service a public URL like:
- `yourapp-api-production.up.railway.app`
- `yourapp-web-production.up.railway.app`

The Postgres service gives you a `DATABASE_URL` automatically.

## Step 3: Set Environment Variables

Set these in Railway's dashboard. **Not in a `.env` file** — the `.env` in the repo is for local development only.

### On the API service:

**Required:**

```env
NODE_ENV=production
DATABASE_URL=<from Railway Postgres service>
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
API_PORT=3001
API_BASE_URL=https://<your-api-service>.up.railway.app
FRONTEND_URL=https://<your-web-service>.up.railway.app
WEBAUTHN_RP_NAME=YourApp
WEBAUTHN_RP_ID=<your-web-service>.up.railway.app
WEBAUTHN_ORIGIN=https://<your-web-service>.up.railway.app
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

**Optional (enable as needed):**

```env
# Google OAuth
FEATURE_AUTH_GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALLBACK_URL=https://<your-api-service>.up.railway.app/auth/google/callback

# Stripe Payments
FEATURE_STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Redis (recommended if you scale to multiple API instances)
FEATURE_REDIS_ENABLED=true
REDIS_URL=redis://host:6379

# File uploads (Cloudflare R2 — without this, uploads are lost on redeploy)
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

### On the Web service:

```env
NUXT_PUBLIC_API_BASE_URL=https://<your-api-service>.up.railway.app
```

## Step 4: Deploy

Trigger a deploy (or push to main — Railway auto-deploys).

The API image automatically runs database migrations on startup, so the database schema is created for you.

## Step 5: Verify

- [ ] `GET https://<api-url>/health` returns `{ status: "ok" }`
- [ ] `https://<web-url>` loads the app
- [ ] Register an account and verify the email flow works
- [ ] `https://<api-url>/api/docs` loads API documentation

If using Stripe:
- [ ] Create products in Stripe Dashboard, seed the database
- [ ] Set up webhook URL: `https://<api-url>/stripe/webhooks`
- [ ] Test a checkout flow

## Adding a Custom Domain (Later)

When you're ready for `yourdomain.com` instead of `*.up.railway.app`:

1. **In Railway:** Go to each service's settings → Custom Domain → add your domain
   - API: `api.yourdomain.com`
   - Web: `yourdomain.com`
2. **In your DNS provider:** Add CNAME records pointing to Railway's URLs
3. **Update env vars** in Railway:
   - API service: `API_BASE_URL`, `FRONTEND_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`
   - Web service: `NUXT_PUBLIC_API_BASE_URL`
   - If using Google OAuth: update `GOOGLE_CALLBACK_URL` + redirect URIs in Google Console
4. Railway handles SSL certificates automatically

No code changes needed — just env vars and DNS.

## CI/CD

The repo includes a GitHub Actions pipeline (`.github/workflows/ci.yml`) that runs on every push and PR:

- TypeScript type checking (API + Web)
- Unit tests
- API e2e tests (with Postgres)
- Playwright browser tests
- Docker build verification

## Architecture

```
Browser → Web App (port 3000) → API (port 3001) → PostgreSQL
                                       ↓
                                     Redis (optional)
```

Both apps are stateless. The API runs migrations on startup. Redis is only needed if you run multiple API instances.
