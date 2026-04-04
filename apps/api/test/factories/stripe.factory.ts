/**
 * # Stripe-Related Factories
 *
 * Creates Subscription, Payment, and StripeCustomer records for testing
 * billing flows. Product and Plan factories already exist in product.factory.ts.
 *
 * ## Usage
 *
 * ```typescript
 * const user = await createUser(prisma);
 * const product = await createProduct(prisma);
 * const plan = await createPlan(prisma, { productId: product.id });
 * const customer = await createStripeCustomer(prisma, { userId: user.id });
 * const subscription = await createSubscription(prisma, { userId: user.id, planId: plan.id });
 * const payment = await createPayment(prisma, { userId: user.id, planId: plan.id });
 * ```
 */
import { PrismaClient } from '@paisa/db';
import type { Subscription, Payment, StripeCustomer } from '@paisa/db';

let subscriptionCounter = 0;
let paymentCounter = 0;
let customerCounter = 0;

export function resetStripeCounters(): void {
  subscriptionCounter = 0;
  paymentCounter = 0;
  customerCounter = 0;
}

// ── Subscription ──

export interface CreateSubscriptionOptions {
  userId: string;
  planId: string;
  stripeSubscriptionId?: string;
  status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAUSED';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
}

export async function createSubscription(
  prisma: PrismaClient,
  overrides: CreateSubscriptionOptions,
): Promise<Subscription> {
  subscriptionCounter++;

  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  return prisma.subscription.create({
    data: {
      userId: overrides.userId,
      planId: overrides.planId,
      stripeSubscriptionId:
        overrides.stripeSubscriptionId ?? `sub_test_${subscriptionCounter}`,
      status: overrides.status ?? 'ACTIVE',
      currentPeriodStart: overrides.currentPeriodStart ?? now,
      currentPeriodEnd: overrides.currentPeriodEnd ?? oneMonthLater,
      cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
      canceledAt: overrides.canceledAt ?? null,
    },
  });
}

// ── Payment ──

export interface CreatePaymentOptions {
  userId: string;
  planId: string;
  stripePaymentIntentId?: string;
  amountInCents?: number;
  currency?: string;
  status?: 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
}

export async function createPayment(
  prisma: PrismaClient,
  overrides: CreatePaymentOptions,
): Promise<Payment> {
  paymentCounter++;

  return prisma.payment.create({
    data: {
      userId: overrides.userId,
      planId: overrides.planId,
      stripePaymentIntentId:
        overrides.stripePaymentIntentId ?? `pi_test_${paymentCounter}`,
      amountInCents: overrides.amountInCents ?? 999,
      currency: overrides.currency ?? 'usd',
      status: overrides.status ?? 'SUCCEEDED',
    },
  });
}

// ── StripeCustomer ──

export interface CreateStripeCustomerOptions {
  userId: string;
  stripeCustomerId?: string;
}

export async function createStripeCustomer(
  prisma: PrismaClient,
  overrides: CreateStripeCustomerOptions,
): Promise<StripeCustomer> {
  customerCounter++;

  return prisma.stripeCustomer.create({
    data: {
      userId: overrides.userId,
      stripeCustomerId:
        overrides.stripeCustomerId ?? `cus_test_${customerCounter}`,
    },
  });
}
