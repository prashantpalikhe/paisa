/**
 * # StripePortalService Unit Tests
 *
 * Tests Stripe Billing Portal session creation.
 *
 * ## What we test
 *
 * - createPortalSession: success case with valid customer
 * - createPortalSession: NotFoundException when no customer exists
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StripePortalService } from './stripe-portal.service';

// ── Mock Stripe SDK ──
const mockStripe = {
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
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
  getCustomerId: vi.fn(),
};

describe('StripePortalService', () => {
  let service: StripePortalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripePortalService(
      mockStripe as any,
      mockConfig as any,
      mockCustomerService as any,
    );
  });

  it('should create a billing portal session', async () => {
    mockCustomerService.getCustomerId.mockResolvedValue('cus_123');
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/session',
    });

    const result = await service.createPortalSession('user-1');

    expect(result.url).toBe('https://billing.stripe.com/session');
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'http://localhost:3000/billing',
    });
  });

  it('should throw NotFoundException when user has no Stripe customer', async () => {
    mockCustomerService.getCustomerId.mockResolvedValue(null);

    await expect(
      service.createPortalSession('user-1'),
    ).rejects.toThrow(NotFoundException);

    expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
});
