/**
 * # StripeWebhookService Unit Tests
 *
 * Tests all webhook event handlers and the status mapping helper.
 *
 * ## What we test
 *
 * - handleEvent: routes to correct handler, ignores unknown events
 * - handleCheckoutCompleted: subscription mode, payment mode, missing metadata
 * - handleInvoicePaid: updates subscription period, unknown subscription
 * - handleInvoicePaymentFailed: marks subscription past_due, emits event
 * - handleSubscriptionUpdated: syncs status/period/cancellation, resolves plan
 * - handleSubscriptionDeleted: marks canceled, emits event
 * - mapStripeStatus: maps all Stripe statuses, defaults to ACTIVE
 * - Idempotency: upsert patterns handle duplicate events
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeWebhookService } from './stripe-webhook.service';
import { DOMAIN_EVENTS, SUBSCRIPTION_STATUS } from '@paisa/shared';

// ── Mock Stripe SDK ──
const mockStripe = {
  subscriptions: {
    retrieve: vi.fn(),
  },
};

// ── Mock DatabaseService ──
const mockDb = {
  subscription: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  payment: {
    upsert: vi.fn(),
  },
  plan: {
    findUnique: vi.fn(),
  },
};

// ── Mock EventBusService ──
const mockEventBus = {
  emit: vi.fn(),
};

// ── Helper: build a Stripe event ──
function buildEvent(type: string, data: any) {
  return {
    id: `evt_${Date.now()}`,
    type,
    data: { object: data },
  };
}

// ── Reusable test data ──
const stripeSubItem = {
  current_period_start: 1700000000,
  current_period_end: 1702592000,
  price: { id: 'price_monthly' },
};

const stripeSubscription = {
  id: 'sub_stripe_1',
  status: 'active',
  cancel_at_period_end: false,
  canceled_at: null,
  items: { data: [stripeSubItem] },
};

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeWebhookService(
      mockStripe as any,
      mockDb as any,
      mockEventBus as any,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // handleEvent — routing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should silently ignore unknown event types', async () => {
    const event = buildEvent('charge.refunded', {});

    await expect(service.handleEvent(event as any)).resolves.not.toThrow();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // checkout.session.completed — subscription mode
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should create subscription from checkout (subscription mode)', async () => {
    const session = {
      id: 'cs_1',
      mode: 'subscription',
      subscription: 'sub_stripe_1',
      metadata: { userId: 'user-1', planId: 'plan-1' },
    };
    mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscription);
    mockDb.subscription.upsert.mockResolvedValue({});

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_stripe_1');
    expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_stripe_1' },
        create: expect.objectContaining({
          userId: 'user-1',
          planId: 'plan-1',
          stripeSubscriptionId: 'sub_stripe_1',
          status: SUBSCRIPTION_STATUS.ACTIVE,
        }),
      }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.SUBSCRIPTION_CREATED,
      expect.objectContaining({
        userId: 'user-1',
        planId: 'plan-1',
        stripeSubscriptionId: 'sub_stripe_1',
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // checkout.session.completed — payment mode
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should create payment from checkout (payment mode)', async () => {
    const session = {
      id: 'cs_2',
      mode: 'payment',
      payment_intent: 'pi_123',
      amount_total: 2999,
      currency: 'usd',
      metadata: { userId: 'user-1', planId: 'plan-2' },
    };
    mockDb.payment.upsert.mockResolvedValue({});

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripePaymentIntentId: 'pi_123' },
        create: expect.objectContaining({
          userId: 'user-1',
          planId: 'plan-2',
          stripePaymentIntentId: 'pi_123',
          amountInCents: 2999,
          currency: 'usd',
          status: 'SUCCEEDED',
        }),
      }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PAYMENT_SUCCEEDED,
      expect.objectContaining({
        userId: 'user-1',
        amountInCents: 2999,
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // checkout.session.completed — missing metadata
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should skip checkout when metadata is missing', async () => {
    const session = {
      id: 'cs_bad',
      mode: 'subscription',
      metadata: {},
    };

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
    expect(mockDb.payment.upsert).not.toHaveBeenCalled();
  });

  it('should skip subscription creation when subscription ID missing', async () => {
    const session = {
      id: 'cs_no_sub',
      mode: 'subscription',
      subscription: null,
      metadata: { userId: 'user-1', planId: 'plan-1' },
    };

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
  });

  it('should skip payment creation when payment_intent ID missing', async () => {
    const session = {
      id: 'cs_no_pi',
      mode: 'payment',
      payment_intent: null,
      metadata: { userId: 'user-1', planId: 'plan-2' },
    };

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.payment.upsert).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // invoice.paid
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should update subscription on invoice.paid', async () => {
    const invoice = {
      id: 'inv_1',
      parent: {
        subscription_details: { subscription: 'sub_stripe_1' },
      },
    };
    mockDb.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      planId: 'plan-1',
      stripeSubscriptionId: 'sub_stripe_1',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscription);
    mockDb.subscription.update.mockResolvedValue({});

    await service.handleEvent(buildEvent('invoice.paid', invoice) as any);

    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_stripe_1' },
        data: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.ACTIVE,
        }),
      }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.SUBSCRIPTION_RENEWED,
      expect.objectContaining({
        userId: 'user-1',
        stripeSubscriptionId: 'sub_stripe_1',
      }),
    );
  });

  it('should skip invoice.paid for one-time invoices (no subscription)', async () => {
    const invoice = {
      id: 'inv_once',
      parent: { subscription_details: { subscription: null } },
    };

    await service.handleEvent(buildEvent('invoice.paid', invoice) as any);

    expect(mockDb.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('should skip invoice.paid for unknown subscription', async () => {
    const invoice = {
      id: 'inv_unknown',
      parent: {
        subscription_details: { subscription: 'sub_unknown' },
      },
    };
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await service.handleEvent(buildEvent('invoice.paid', invoice) as any);

    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockDb.subscription.update).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // invoice.payment_failed
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should mark subscription as PAST_DUE on payment failure', async () => {
    const invoice = {
      id: 'inv_fail',
      parent: {
        subscription_details: { subscription: 'sub_stripe_1' },
      },
    };
    mockDb.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      planId: 'plan-1',
      stripeSubscriptionId: 'sub_stripe_1',
      user: { email: 'test@example.com' },
    });
    mockDb.subscription.update.mockResolvedValue({});

    await service.handleEvent(buildEvent('invoice.payment_failed', invoice) as any);

    expect(mockDb.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_stripe_1' },
      data: { status: SUBSCRIPTION_STATUS.PAST_DUE },
    });
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PAYMENT_FAILED,
      expect.objectContaining({
        userId: 'user-1',
        email: 'test@example.com',
      }),
    );
  });

  it('should skip invoice.payment_failed for unknown subscription', async () => {
    const invoice = {
      id: 'inv_fail_unknown',
      parent: {
        subscription_details: { subscription: 'sub_unknown' },
      },
    };
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await service.handleEvent(buildEvent('invoice.payment_failed', invoice) as any);

    expect(mockDb.subscription.update).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // customer.subscription.updated
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should update subscription status and period on subscription.updated', async () => {
    const stripeSub = {
      ...stripeSubscription,
      cancel_at_period_end: true,
      canceled_at: 1700100000,
    };
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
    });
    mockDb.plan.findUnique.mockResolvedValue({ id: 'plan-1' });
    mockDb.subscription.update.mockResolvedValue({});

    await service.handleEvent(buildEvent('customer.subscription.updated', stripeSub) as any);

    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_stripe_1' },
        data: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.ACTIVE,
          cancelAtPeriodEnd: true,
          canceledAt: new Date(1700100000 * 1000),
          planId: 'plan-1',
        }),
      }),
    );
  });

  it('should set canceledAt to null when not canceled', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
    });
    mockDb.plan.findUnique.mockResolvedValue(null); // no matching plan
    mockDb.subscription.update.mockResolvedValue({});

    await service.handleEvent(
      buildEvent('customer.subscription.updated', stripeSubscription) as any,
    );

    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          canceledAt: null,
        }),
      }),
    );
  });

  it('should skip subscription.updated for unknown subscription', async () => {
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await service.handleEvent(
      buildEvent('customer.subscription.updated', stripeSubscription) as any,
    );

    expect(mockDb.subscription.update).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // customer.subscription.deleted
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should mark subscription as CANCELED on deletion', async () => {
    mockDb.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      planId: 'plan-1',
      stripeSubscriptionId: 'sub_stripe_1',
    });
    mockDb.subscription.update.mockResolvedValue({});

    await service.handleEvent(
      buildEvent('customer.subscription.deleted', stripeSubscription) as any,
    );

    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_stripe_1' },
        data: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceledAt: expect.any(Date),
        }),
      }),
    );
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.SUBSCRIPTION_CANCELED,
      expect.objectContaining({
        userId: 'user-1',
        stripeSubscriptionId: 'sub_stripe_1',
      }),
    );
  });

  it('should skip subscription.deleted for unknown subscription', async () => {
    mockDb.subscription.findUnique.mockResolvedValue(null);

    await service.handleEvent(
      buildEvent('customer.subscription.deleted', stripeSubscription) as any,
    );

    expect(mockDb.subscription.update).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // mapStripeStatus (tested indirectly via handleEvent)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should map trialing status correctly', async () => {
    const trialingSub = { ...stripeSubscription, status: 'trialing' };
    const session = {
      id: 'cs_trial',
      mode: 'subscription',
      subscription: 'sub_stripe_1',
      metadata: { userId: 'user-1', planId: 'plan-1' },
    };
    mockStripe.subscriptions.retrieve.mockResolvedValue(trialingSub);
    mockDb.subscription.upsert.mockResolvedValue({});

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.TRIALING,
        }),
      }),
    );
  });

  it('should map past_due status correctly', async () => {
    const pastDueSub = { ...stripeSubscription, status: 'past_due' };
    const session = {
      id: 'cs_pd',
      mode: 'subscription',
      subscription: 'sub_stripe_1',
      metadata: { userId: 'user-1', planId: 'plan-1' },
    };
    mockStripe.subscriptions.retrieve.mockResolvedValue(pastDueSub);
    mockDb.subscription.upsert.mockResolvedValue({});

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.PAST_DUE,
        }),
      }),
    );
  });

  it('should default to ACTIVE for unknown Stripe status', async () => {
    const unknownSub = { ...stripeSubscription, status: 'some_future_status' };
    const session = {
      id: 'cs_unknown',
      mode: 'subscription',
      subscription: 'sub_stripe_1',
      metadata: { userId: 'user-1', planId: 'plan-1' },
    };
    mockStripe.subscriptions.retrieve.mockResolvedValue(unknownSub);
    mockDb.subscription.upsert.mockResolvedValue({});

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.ACTIVE,
        }),
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Idempotency
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should use upsert for subscription creation (idempotent)', async () => {
    const session = {
      id: 'cs_1',
      mode: 'subscription',
      subscription: 'sub_stripe_1',
      metadata: { userId: 'user-1', planId: 'plan-1' },
    };
    mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSubscription);
    mockDb.subscription.upsert.mockResolvedValue({});

    // Process the same event twice
    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);
    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    // Upsert is used, so duplicate processing is safe
    expect(mockDb.subscription.upsert).toHaveBeenCalledTimes(2);
  });

  it('should use upsert for payment creation (idempotent)', async () => {
    const session = {
      id: 'cs_2',
      mode: 'payment',
      payment_intent: 'pi_123',
      amount_total: 2999,
      currency: 'usd',
      metadata: { userId: 'user-1', planId: 'plan-2' },
    };
    mockDb.payment.upsert.mockResolvedValue({});

    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);
    await service.handleEvent(buildEvent('checkout.session.completed', session) as any);

    expect(mockDb.payment.upsert).toHaveBeenCalledTimes(2);
  });
});
