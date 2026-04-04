/**
 * # Stripe Subscription Service
 *
 * Queries and manages subscriptions for authenticated users.
 *
 * ## Read vs Write
 *
 * - **Reads** (get status, list) → Query our database (fast, no Stripe API call)
 * - **Writes** (cancel, resume) → Call Stripe API, then webhook syncs DB
 *
 * We never update subscription status directly in our DB from user actions.
 * The flow is always: User action → Stripe API → Stripe webhook → DB update.
 * This ensures Stripe and our DB are always in sync.
 */
import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Stripe } from '../stripe-types';
import { STRIPE_CLIENT } from '../stripe.constants';
import { DatabaseService } from '../../../core/database/database.service';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '@paisa/shared';

@Injectable()
export class StripeSubscriptionService {
  private readonly logger = new Logger(StripeSubscriptionService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Get the user's active subscription (if any).
   *
   * Returns the most recent active subscription with its plan details.
   * A user can only have one active subscription per product (enforced
   * at checkout time), but could have subscriptions to different products.
   */
  async getActiveSubscription(userId: string): Promise<any> {
    return this.db.subscription.findFirst({
      where: {
        userId,
        status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
      },
      include: {
        plan: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all subscriptions for a user (including canceled ones).
   * Useful for showing subscription history.
   */
  async getAllSubscriptions(userId: string): Promise<any[]> {
    return this.db.subscription.findMany({
      where: { userId },
      include: {
        plan: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all one-time payments for a user.
   */
  async getPayments(userId: string): Promise<any[]> {
    return this.db.payment.findMany({
      where: { userId },
      include: {
        plan: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cancel a subscription at the end of the current billing period.
   *
   * The user keeps access until the period ends. This is the standard
   * cancellation flow — immediate cancellation is available via the
   * Stripe Customer Portal if needed.
   *
   * Flow: We tell Stripe → Stripe sends subscription.updated webhook
   * → Our webhook handler updates the DB with cancelAtPeriodEnd=true.
   */
  async cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.db.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId, // Ownership check
        status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Active subscription not found');
    }

    // Tell Stripe to cancel at period end
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Don't update DB directly — the webhook will handle it.
    // This ensures Stripe and our DB are always in sync.

    this.logger.log(
      `Subscription ${subscription.stripeSubscriptionId} scheduled for cancellation ` +
      `at period end for user ${userId}`,
    );
  }

  /**
   * Resume a subscription that was scheduled for cancellation.
   *
   * Undoes "cancel at period end" — the subscription will renew normally.
   */
  async resumeSubscription(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.db.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
        cancelAtPeriodEnd: true, // Can only resume if it's pending cancellation
        status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        'No subscription pending cancellation found',
      );
    }

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    this.logger.log(
      `Subscription ${subscription.stripeSubscriptionId} resumed for user ${userId}`,
    );
  }

  /**
   * Check if a user has an active subscription (or payment) for a product.
   *
   * This is the generic "has this user paid for this?" check.
   * Works for both subscriptions and one-time payments.
   */
  async hasAccessToProduct(userId: string, productId: string): Promise<boolean> {
    // Check subscriptions
    const activeSub = await this.db.subscription.findFirst({
      where: {
        userId,
        plan: { productId },
        status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
      },
    });

    if (activeSub) return true;

    // Check one-time payments
    const payment = await this.db.payment.findFirst({
      where: {
        userId,
        plan: { productId },
        status: 'SUCCEEDED',
      },
    });

    return !!payment;
  }
}
