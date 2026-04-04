/**
 * # StripeCheckoutService Unit Tests
 *
 * Tests Stripe Checkout Session creation logic.
 *
 * ## What we test
 *
 * - createCheckoutSession: subscription mode, payment mode
 * - NotFoundException for invalid/inactive plan or inactive product
 * - ConflictException for duplicate active subscription
 * - Trial days applied for subscription plans
 * - Error when Stripe returns no URL
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { StripeCheckoutService } from './stripe-checkout.service';

// ── Mock Stripe SDK ──
const mockStripe = {
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
};

// ── Mock DatabaseService ──
const mockDb = {
  plan: {
    findUnique: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
};

// ── Mock AppConfigService ──
const mockConfig = {
  env: {
    FRONTEND_URL: 'http://localhost:3000',
  },
};

// ── Mock StripeCustomerService ──
const mockCustomerService = {
  getOrCreateCustomer: vi.fn(),
};

// ── Test data ──
const subscriptionPlan = {
  id: 'plan-1',
  active: true,
  interval: 'monthly',
  stripePriceId: 'price_monthly',
  productId: 'product-1',
  trialDays: null,
  product: { id: 'product-1', active: true },
};

const oneTimePlan = {
  id: 'plan-2',
  active: true,
  interval: 'one_time',
  stripePriceId: 'price_once',
  productId: 'product-2',
  trialDays: null,
  product: { id: 'product-2', active: true },
};

describe('StripeCheckoutService', () => {
  let service: StripeCheckoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeCheckoutService(
      mockStripe as any,
      mockDb as any,
      mockConfig as any,
      mockCustomerService as any,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBSCRIPTION MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should create a subscription checkout session', async () => {
    mockDb.plan.findUnique.mockResolvedValue(subscriptionPlan);
    mockDb.subscription.findFirst.mockResolvedValue(null);
    mockCustomerService.getOrCreateCustomer.mockResolvedValue('cus_123');
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/session',
    });

    const result = await service.createCheckoutSession(
      'user-1', 'test@example.com', 'Test', 'plan-1',
    );

    expect(result.url).toBe('https://checkout.stripe.com/session');
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_123',
        mode: 'subscription',
        line_items: [{ price: 'price_monthly', quantity: 1 }],
        metadata: { userId: 'user-1', planId: 'plan-1' },
        subscription_data: expect.objectContaining({
          metadata: { userId: 'user-1', planId: 'plan-1' },
        }),
      }),
    );
  });

  it('should apply trial days for subscription plans', async () => {
    const planWithTrial = { ...subscriptionPlan, trialDays: 14 };
    mockDb.plan.findUnique.mockResolvedValue(planWithTrial);
    mockDb.subscription.findFirst.mockResolvedValue(null);
    mockCustomerService.getOrCreateCustomer.mockResolvedValue('cus_123');
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/session',
    });

    await service.createCheckoutSession('user-1', 'test@example.com', null, 'plan-1');

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({
          trial_period_days: 14,
        }),
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAYMENT MODE (one-time)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should create a payment checkout session for one-time plans', async () => {
    mockDb.plan.findUnique.mockResolvedValue(oneTimePlan);
    mockCustomerService.getOrCreateCustomer.mockResolvedValue('cus_123');
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_456',
      url: 'https://checkout.stripe.com/pay',
    });

    const result = await service.createCheckoutSession(
      'user-1', 'test@example.com', 'Test', 'plan-2',
    );

    expect(result.url).toBe('https://checkout.stripe.com/pay');
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [{ price: 'price_once', quantity: 1 }],
      }),
    );
    // Should NOT have subscription_data
    const callArgs = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(callArgs.subscription_data).toBeUndefined();
  });

  it('should NOT check for existing subscriptions on one-time plans', async () => {
    mockDb.plan.findUnique.mockResolvedValue(oneTimePlan);
    mockCustomerService.getOrCreateCustomer.mockResolvedValue('cus_123');
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_456',
      url: 'https://checkout.stripe.com/pay',
    });

    await service.createCheckoutSession('user-1', 'test@example.com', null, 'plan-2');

    expect(mockDb.subscription.findFirst).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERROR CASES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should throw NotFoundException when plan does not exist', async () => {
    mockDb.plan.findUnique.mockResolvedValue(null);

    await expect(
      service.createCheckoutSession('user-1', 'test@example.com', null, 'bad-plan'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when plan is inactive', async () => {
    mockDb.plan.findUnique.mockResolvedValue({
      ...subscriptionPlan,
      active: false,
    });

    await expect(
      service.createCheckoutSession('user-1', 'test@example.com', null, 'plan-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when product is inactive', async () => {
    mockDb.plan.findUnique.mockResolvedValue({
      ...subscriptionPlan,
      product: { id: 'product-1', active: false },
    });

    await expect(
      service.createCheckoutSession('user-1', 'test@example.com', null, 'plan-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when user has active subscription for same product', async () => {
    mockDb.plan.findUnique.mockResolvedValue(subscriptionPlan);
    mockDb.subscription.findFirst.mockResolvedValue({
      id: 'sub-existing',
      status: 'ACTIVE',
    });

    await expect(
      service.createCheckoutSession('user-1', 'test@example.com', null, 'plan-1'),
    ).rejects.toThrow(ConflictException);

    // Should NOT proceed to create customer or session
    expect(mockCustomerService.getOrCreateCustomer).not.toHaveBeenCalled();
  });

  it('should throw Error when Stripe returns no checkout URL', async () => {
    mockDb.plan.findUnique.mockResolvedValue(subscriptionPlan);
    mockDb.subscription.findFirst.mockResolvedValue(null);
    mockCustomerService.getOrCreateCustomer.mockResolvedValue('cus_123');
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_bad',
      url: null,
    });

    await expect(
      service.createCheckoutSession('user-1', 'test@example.com', null, 'plan-1'),
    ).rejects.toThrow('Stripe did not return a checkout URL');
  });
});
