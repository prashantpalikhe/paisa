/**
 * # StripeCustomerService Unit Tests
 *
 * Tests the Stripe customer management logic.
 *
 * ## What we test
 *
 * - getOrCreateCustomer: returns existing, creates new, handles concurrent upsert
 * - getCustomerId: returns ID when found, null when not found
 * - updateCustomerEmail: updates Stripe when customer exists, no-op when not
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeCustomerService } from './stripe-customer.service';

// ── Mock Stripe SDK ──
const mockStripe = {
  customers: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

// ── Mock DatabaseService ──
const mockDb = {
  stripeCustomer: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};

describe('StripeCustomerService', () => {
  let service: StripeCustomerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeCustomerService(
      mockStripe as any,
      mockDb as any,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getOrCreateCustomer
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return existing Stripe customer ID if mapping exists', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue({
      userId: 'user-1',
      stripeCustomerId: 'cus_existing',
    });

    const result = await service.getOrCreateCustomer('user-1', 'test@example.com', 'Test');

    expect(result).toBe('cus_existing');
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockDb.stripeCustomer.upsert).not.toHaveBeenCalled();
  });

  it('should create a new Stripe customer and save mapping when none exists', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue(null);
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockDb.stripeCustomer.upsert.mockResolvedValue({
      userId: 'user-1',
      stripeCustomerId: 'cus_new',
    });

    const result = await service.getOrCreateCustomer('user-1', 'test@example.com', 'Test User');

    expect(result).toBe('cus_new');
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test User',
      metadata: { userId: 'user-1' },
    });
    expect(mockDb.stripeCustomer.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', stripeCustomerId: 'cus_new' },
      update: {},
    });
  });

  it('should pass undefined for name when name is null', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue(null);
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockDb.stripeCustomer.upsert.mockResolvedValue({
      userId: 'user-1',
      stripeCustomerId: 'cus_new',
    });

    await service.getOrCreateCustomer('user-1', 'test@example.com', null);

    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: undefined }),
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getCustomerId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should return customer ID when mapping exists', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_123',
    });

    const result = await service.getCustomerId('user-1');
    expect(result).toBe('cus_123');
  });

  it('should return null when no mapping exists', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue(null);

    const result = await service.getCustomerId('user-1');
    expect(result).toBeNull();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // updateCustomerEmail
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('should update Stripe customer email when mapping exists', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_123',
    });

    await service.updateCustomerEmail('user-1', 'new@example.com');

    expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', {
      email: 'new@example.com',
    });
  });

  it('should do nothing when user has no Stripe customer', async () => {
    mockDb.stripeCustomer.findUnique.mockResolvedValue(null);

    await service.updateCustomerEmail('user-1', 'new@example.com');

    expect(mockStripe.customers.update).not.toHaveBeenCalled();
  });
});
