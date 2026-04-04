/**
 * # Stripe Billing E2E Tests
 *
 * Tests the Stripe billing endpoints against a real NestJS app with
 * a real PostgreSQL database but a MOCKED Stripe SDK.
 *
 * ## Why mock Stripe?
 *
 * The Stripe SDK calls Stripe's API over the network. E2e tests need
 * to be fast, offline-capable, and deterministic. We mock the SDK
 * to control responses while still testing the full request lifecycle:
 *
 * HTTP request → middleware → guards → pipes → controller → service → database → response
 *
 * ## Environment setup
 *
 * The Stripe module is conditionally loaded when `FEATURE_STRIPE_ENABLED=true`.
 * We set this env var before the app boots and override the STRIPE_CLIENT
 * provider with a mock via `createTestApp({ customize })`.
 */

// ── Set Stripe env vars BEFORE any module evaluation ──
// These must be set before AppModule is imported, because
// parseFeatures(process.env) runs at module-evaluation time.
// Since vitest may cache modules across test files, this is
// set as early as possible.
process.env.FEATURE_STRIPE_ENABLED = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake';

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@paisa/db';
import request from 'supertest';
import { createTestApp, getPrisma, resetDatabase } from '../helpers';
import { STRIPE_CLIENT } from '../../src/modules/stripe/stripe.constants';
import {
  createUser,
  createProduct,
  createPlan,
  createSubscription,
  createPayment,
  createStripeCustomer,
  resetStripeCounters,
  resetProductCounters,
  resetUserCounter,
} from '../factories';

/**
 * Mock Stripe SDK.
 *
 * Only includes methods used by the controllers/services under test.
 * Each test can configure return values via `mockReturnValue` / `mockResolvedValue`.
 */
function createMockStripe() {
  return {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_mock_123' }),
      update: vi.fn().mockResolvedValue({}),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_mock_123',
          url: 'https://checkout.stripe.com/mock-session',
        }),
      },
    },
    subscriptions: {
      update: vi.fn().mockResolvedValue({}),
      retrieve: vi.fn().mockResolvedValue({}),
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          url: 'https://billing.stripe.com/mock-portal',
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };
}

/**
 * Helper: register a user via the API and return the access token.
 */
async function registerAndGetToken(
  app: INestApplication,
  email = 'billing@example.com',
): Promise<{ token: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'Password123', name: 'Billing User' })
    .expect(201);

  return {
    token: res.body.data.accessToken,
    userId: res.body.data.user.id,
  };
}

describe('Stripe Billing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let mockStripe: ReturnType<typeof createMockStripe>;

  beforeAll(async () => {
    mockStripe = createMockStripe();

    app = await createTestApp({
      customize: (builder) =>
        builder.overrideProvider(STRIPE_CLIENT).useValue(mockStripe),
    });
    prisma = getPrisma(app);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    resetUserCounter();
    resetProductCounters();
    resetStripeCounters();

    // Reset all mock call history between tests
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRICING (public)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /stripe/pricing → 200 with active products and their plans', async () => {
    const product = await createProduct(prisma, { name: 'Pro Plan' });
    await createPlan(prisma, {
      productId: product.id,
      name: 'Monthly',
      priceInCents: 999,
    });
    await createPlan(prisma, {
      productId: product.id,
      name: 'Yearly',
      priceInCents: 9999,
      interval: 'year',
    });

    const res = await request(app.getHttpServer())
      .get('/stripe/pricing')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: product.id,
      name: 'Pro Plan',
      plans: expect.arrayContaining([
        expect.objectContaining({ name: 'Monthly', priceInCents: 999 }),
        expect.objectContaining({ name: 'Yearly', priceInCents: 9999 }),
      ]),
    });
  });

  it('GET /stripe/pricing → excludes inactive products and plans', async () => {
    // Inactive product — should not appear
    const inactiveProduct = await createProduct(prisma, {
      name: 'Deprecated',
      active: false,
    });
    await createPlan(prisma, { productId: inactiveProduct.id });

    // Active product with one active and one inactive plan
    const activeProduct = await createProduct(prisma, { name: 'Active' });
    await createPlan(prisma, {
      productId: activeProduct.id,
      name: 'Visible Plan',
      active: true,
    });
    await createPlan(prisma, {
      productId: activeProduct.id,
      name: 'Hidden Plan',
      active: false,
    });

    const res = await request(app.getHttpServer())
      .get('/stripe/pricing')
      .expect(200);

    // Only the active product should be returned
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Active');

    // Only the active plan should be included
    expect(res.body.data[0].plans).toHaveLength(1);
    expect(res.body.data[0].plans[0].name).toBe('Visible Plan');
  });

  it('GET /stripe/pricing → 200 with empty array when no products', async () => {
    const res = await request(app.getHttpServer())
      .get('/stripe/pricing')
      .expect(200);

    expect(res.body.data).toEqual([]);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECKOUT (authenticated)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /stripe/checkout → 200 with checkout URL for valid plan', async () => {
    const { token } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });

    const res = await request(app.getHttpServer())
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan.id })
      .expect(200);

    expect(res.body.data).toMatchObject({
      url: 'https://checkout.stripe.com/mock-session',
    });

    // Verify Stripe SDK was called
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('POST /stripe/checkout → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/stripe/checkout')
      .send({ planId: 'some-plan-id' })
      .expect(401);
  });

  it('POST /stripe/checkout → 404 for nonexistent plan', async () => {
    const { token } = await registerAndGetToken(app);

    const res = await request(app.getHttpServer())
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 'nonexistent-plan-id' })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /stripe/checkout → 400 for invalid body (missing planId)', async () => {
    const { token } = await registerAndGetToken(app);

    const res = await request(app.getHttpServer())
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /stripe/checkout → 404 for inactive plan', async () => {
    const { token } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, {
      productId: product.id,
      active: false,
    });

    const res = await request(app.getHttpServer())
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan.id })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /stripe/checkout → 409 when already subscribed to the product', async () => {
    const { token, userId } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });

    // Create an existing active subscription
    await createSubscription(prisma, { userId, planId: plan.id });

    const res = await request(app.getHttpServer())
      .post('/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan.id })
      .expect(409);

    expect(res.body.error.code).toBe('CONFLICT');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBSCRIPTION (authenticated)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /stripe/subscription → 200 with active subscription', async () => {
    const { token, userId } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });
    await createSubscription(prisma, {
      userId,
      planId: plan.id,
      status: 'ACTIVE',
    });

    const res = await request(app.getHttpServer())
      .get('/stripe/subscription')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      userId,
      planId: plan.id,
      status: 'ACTIVE',
      plan: expect.objectContaining({
        name: expect.any(String),
        product: expect.objectContaining({
          name: expect.any(String),
        }),
      }),
    });
  });

  it('GET /stripe/subscription → 200 with null when no subscription', async () => {
    const { token } = await registerAndGetToken(app);

    const res = await request(app.getHttpServer())
      .get('/stripe/subscription')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toBeNull();
  });

  it('GET /stripe/subscription → 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/stripe/subscription')
      .expect(401);
  });

  it('GET /stripe/purchases → 200 with subscriptions and payments', async () => {
    const { token, userId } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });

    await createSubscription(prisma, { userId, planId: plan.id });
    await createPayment(prisma, { userId, planId: plan.id });

    const res = await request(app.getHttpServer())
      .get('/stripe/purchases')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.subscriptions).toHaveLength(1);
    expect(res.body.data.payments).toHaveLength(1);
  });

  it('GET /stripe/purchases → 200 with empty arrays when no purchases', async () => {
    const { token } = await registerAndGetToken(app);

    const res = await request(app.getHttpServer())
      .get('/stripe/purchases')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.subscriptions).toEqual([]);
    expect(res.body.data.payments).toEqual([]);
  });

  it('POST /stripe/subscription/cancel → 200 for active subscription', async () => {
    const { token, userId } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });
    const sub = await createSubscription(prisma, { userId, planId: plan.id });

    const res = await request(app.getHttpServer())
      .post('/stripe/subscription/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: sub.id })
      .expect(200);

    expect(res.body.data.message).toContain('canceled');

    // Verify Stripe SDK was called to cancel
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      sub.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );
  });

  it('POST /stripe/subscription/cancel → 404 for wrong subscription ID', async () => {
    const { token } = await registerAndGetToken(app);

    const res = await request(app.getHttpServer())
      .post('/stripe/subscription/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: 'nonexistent-sub-id' })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /stripe/subscription/cancel → 404 for another users subscription', async () => {
    // Register two users
    const { token: token1 } = await registerAndGetToken(app, 'user1@example.com');
    const { userId: userId2 } = await registerAndGetToken(app, 'user2@example.com');

    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });

    // Create subscription for user2
    const sub = await createSubscription(prisma, { userId: userId2, planId: plan.id });

    // User1 tries to cancel user2's subscription
    const res = await request(app.getHttpServer())
      .post('/stripe/subscription/cancel')
      .set('Authorization', `Bearer ${token1}`)
      .send({ subscriptionId: sub.id })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /stripe/subscription/resume → 200 for pending cancellation', async () => {
    const { token, userId } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });
    const sub = await createSubscription(prisma, {
      userId,
      planId: plan.id,
      cancelAtPeriodEnd: true,
    });

    const res = await request(app.getHttpServer())
      .post('/stripe/subscription/resume')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: sub.id })
      .expect(200);

    expect(res.body.data.message).toContain('resumed');

    // Verify Stripe SDK was called to resume
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      sub.stripeSubscriptionId,
      { cancel_at_period_end: false },
    );
  });

  it('POST /stripe/subscription/resume → 404 when not pending cancellation', async () => {
    const { token, userId } = await registerAndGetToken(app);
    const product = await createProduct(prisma);
    const plan = await createPlan(prisma, { productId: product.id });
    const sub = await createSubscription(prisma, {
      userId,
      planId: plan.id,
      cancelAtPeriodEnd: false, // Not pending cancellation
    });

    const res = await request(app.getHttpServer())
      .post('/stripe/subscription/resume')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: sub.id })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PORTAL (authenticated)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /stripe/portal → 200 with portal URL', async () => {
    const { token, userId } = await registerAndGetToken(app);

    // User needs a StripeCustomer record to access the portal
    await createStripeCustomer(prisma, { userId });

    const res = await request(app.getHttpServer())
      .post('/stripe/portal')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      url: 'https://billing.stripe.com/mock-portal',
    });

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('POST /stripe/portal → 404 without Stripe customer', async () => {
    const { token } = await registerAndGetToken(app);

    // No StripeCustomer record — user has never checked out
    const res = await request(app.getHttpServer())
      .post('/stripe/portal')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /stripe/portal → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/stripe/portal')
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // WEBHOOK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /stripe/webhooks → 400 without stripe-signature header', async () => {
    const res = await request(app.getHttpServer())
      .post('/stripe/webhooks')
      .send({ type: 'checkout.session.completed' })
      .expect(400);

    expect(res.body.error.message).toContain('stripe-signature');
  });
});
