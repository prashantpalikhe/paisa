/**
 * # StripeSubscriptionService Unit Tests
 *
 * Tests subscription queries and management.
 *
 * ## What we test
 *
 * - getActiveSubscription: returns active sub or null
 * - getAllSubscriptions: returns all subs for a user
 * - getPayments: returns all one-time payments
 * - cancelSubscription: ownership check, calls Stripe, NotFoundException
 * - resumeSubscription: pending cancellation check, calls Stripe, NotFoundException
 * - hasAccessToProduct: checks subscriptions and one-time payments
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StripeSubscriptionService } from './stripe-subscription.service';

// ── Mock Stripe SDK ──
const mockStripe = {
  subscriptions: {
    update: vi.fn(),
  },
};

// ── Mock DatabaseService ──
const mockDb = {
  subscription: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  payment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};

describe('StripeSubscriptionService', () => {
  let service: StripeSubscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeSubscriptionService(
      mockStripe as any,
      mockDb as any,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getActiveSubscription
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return the active subscription with plan details', async () => {
    const mockSub = {
      id: 'sub-1',
      userId: 'user-1',
      status: 'ACTIVE',
      plan: { id: 'plan-1', product: { id: 'product-1' } },
    };
    mockDb.subscription.findFirst.mockResolvedValue(mockSub);

    const result = await service.getActiveSubscription('user-1');

    expect(result).toEqual(mockSub);
    expect(mockDb.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
        include: { plan: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should return null when no active subscription exists', async () => {
    mockDb.subscription.findFirst.mockResolvedValue(null);

    const result = await service.getActiveSubscription('user-1');
    expect(result).toBeNull();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getAllSubscriptions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return all subscriptions for a user', async () => {
    const subs = [
      { id: 'sub-1', status: 'ACTIVE' },
      { id: 'sub-2', status: 'CANCELED' },
    ];
    mockDb.subscription.findMany.mockResolvedValue(subs);

    const result = await service.getAllSubscriptions('user-1');

    expect(result).toEqual(subs);
    expect(mockDb.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getPayments
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return all payments for a user', async () => {
    const payments = [
      { id: 'pay-1', status: 'SUCCEEDED' },
    ];
    mockDb.payment.findMany.mockResolvedValue(payments);

    const result = await service.getPayments('user-1');

    expect(result).toEqual(payments);
    expect(mockDb.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // cancelSubscription
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should cancel subscription at period end', async () => {
    mockDb.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      stripeSubscriptionId: 'sub_stripe_1',
      status: 'ACTIVE',
    });

    await service.cancelSubscription('user-1', 'sub-1');

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
      cancel_at_period_end: true,
    });
  });

  it('should throw NotFoundException when subscription not found for cancel', async () => {
    mockDb.subscription.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelSubscription('user-1', 'sub-nonexistent'),
    ).rejects.toThrow(NotFoundException);

    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // resumeSubscription
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should resume a subscription pending cancellation', async () => {
    mockDb.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      stripeSubscriptionId: 'sub_stripe_1',
      cancelAtPeriodEnd: true,
      status: 'ACTIVE',
    });

    await service.resumeSubscription('user-1', 'sub-1');

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', {
      cancel_at_period_end: false,
    });
  });

  it('should throw NotFoundException when no subscription pending cancellation', async () => {
    mockDb.subscription.findFirst.mockResolvedValue(null);

    await expect(
      service.resumeSubscription('user-1', 'sub-1'),
    ).rejects.toThrow(NotFoundException);

    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // hasAccessToProduct
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return true when user has active subscription for product', async () => {
    mockDb.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

    const result = await service.hasAccessToProduct('user-1', 'product-1');
    expect(result).toBe(true);

    // Should NOT check payments since subscription was found
    expect(mockDb.payment.findFirst).not.toHaveBeenCalled();
  });

  it('should return true when user has one-time payment for product', async () => {
    mockDb.subscription.findFirst.mockResolvedValue(null);
    mockDb.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'SUCCEEDED' });

    const result = await service.hasAccessToProduct('user-1', 'product-1');
    expect(result).toBe(true);
  });

  it('should return false when user has no subscription or payment', async () => {
    mockDb.subscription.findFirst.mockResolvedValue(null);
    mockDb.payment.findFirst.mockResolvedValue(null);

    const result = await service.hasAccessToProduct('user-1', 'product-1');
    expect(result).toBe(false);
  });
});
