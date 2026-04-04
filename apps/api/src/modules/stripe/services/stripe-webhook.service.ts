/**
 * # Stripe Webhook Service
 *
 * Processes incoming Stripe webhook events. This is the heart of the
 * Stripe integration — ALL state changes come through here.
 *
 * ## Why webhooks?
 *
 * After a user pays on Stripe Checkout, the browser redirects to our
 * success page. But we NEVER trust that redirect to create the
 * subscription/payment. Why?
 *
 * 1. The user could close the browser before the redirect
 * 2. The network could drop
 * 3. The user could forge the redirect URL
 *
 * Instead, Stripe sends a webhook (server-to-server HTTP POST) that
 * reliably tells us what happened. This is the ONLY way we create
 * subscriptions and record payments.
 *
 * ## Idempotency
 *
 * Stripe may send the same event multiple times (retries on failure).
 * Every handler must be idempotent — processing the same event twice
 * should produce the same result. We use Prisma `upsert` or
 * check-before-write patterns to achieve this.
 *
 * ## Event flow
 *
 * ```
 * Stripe webhook POST
 *   → Signature verified (in controller)
 *   → Event dispatched to handler method here
 *   → DB updated
 *   → Domain event emitted via EventBus
 *   → Email module sends notification (if listening)
 * ```
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Stripe } from '../stripe-types';
import { STRIPE_CLIENT } from '../stripe.constants';
import { DatabaseService } from '../../../core/database/database.service';
import { EventBusService } from '../../../common/event-bus/event-bus.service';
import { DOMAIN_EVENTS, SUBSCRIPTION_STATUS } from '@paisa/shared';
import type { SubscriptionStatus } from '@paisa/shared';
import type { HandledStripeEvent } from '../stripe.constants';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly db: DatabaseService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Route an incoming webhook event to the appropriate handler.
   *
   * The controller calls this after verifying the signature.
   * Unknown event types are silently ignored (Stripe sends many
   * events we don't care about).
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    const eventType = event.type as HandledStripeEvent;

    this.logger.log(`Processing webhook: ${eventType} (${event.id})`);

    switch (eventType) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        this.logger.debug(`Ignoring unhandled event type: ${event.type}`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECKOUT SESSION COMPLETED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Handles the `checkout.session.completed` event.
   *
   * This fires when a user successfully completes Stripe Checkout.
   * Depending on the checkout mode:
   *
   * - mode=subscription → Create a Subscription record
   * - mode=payment → Create a Payment record (one-time purchase)
   *
   * The metadata on the checkout session contains our `userId` and
   * `planId`, which we set when creating the session.
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    if (!userId || !planId) {
      this.logger.warn(`Checkout session ${session.id} missing metadata (userId: ${userId}, planId: ${planId})`);
      return;
    }

    if (session.mode === 'subscription') {
      await this.createSubscriptionFromCheckout(session, userId, planId);
    } else if (session.mode === 'payment') {
      await this.createPaymentFromCheckout(session, userId, planId);
    }
  }

  /**
   * Create a Subscription record from a completed checkout session.
   */
  private async createSubscriptionFromCheckout(
    session: Stripe.Checkout.Session,
    userId: string,
    planId: string,
  ): Promise<void> {
    const stripeSubscriptionId = session.subscription as string;
    if (!stripeSubscriptionId) {
      this.logger.warn(`Checkout session ${session.id} has no subscription ID`);
      return;
    }

    // Fetch the full subscription from Stripe to get period dates
    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    // In Stripe SDK v22 (API 2026-03-25.dahlia), period dates moved to subscription items
    const firstItem = stripeSub.items.data[0];

    // Upsert: idempotent — if the webhook is retried, we just update
    await this.db.subscription.upsert({
      where: { stripeSubscriptionId },
      create: {
        userId,
        planId,
        stripeSubscriptionId,
        status: this.mapStripeStatus(stripeSub.status),
        currentPeriodStart: new Date(firstItem.current_period_start * 1000),
        currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
      update: {
        status: this.mapStripeStatus(stripeSub.status),
        currentPeriodStart: new Date(firstItem.current_period_start * 1000),
        currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
      },
    });

    this.logger.log(`Subscription created: ${stripeSubscriptionId} for user ${userId}`);

    this.eventBus.emit(DOMAIN_EVENTS.SUBSCRIPTION_CREATED, {
      userId,
      planId,
      stripeSubscriptionId,
    });
  }

  /**
   * Create a Payment record from a completed one-time checkout session.
   */
  private async createPaymentFromCheckout(
    session: Stripe.Checkout.Session,
    userId: string,
    planId: string,
  ): Promise<void> {
    const paymentIntentId = session.payment_intent as string;
    if (!paymentIntentId) {
      this.logger.warn(`Checkout session ${session.id} has no payment_intent ID`);
      return;
    }

    // Upsert: idempotent — safe against retries
    await this.db.payment.upsert({
      where: { stripePaymentIntentId: paymentIntentId },
      create: {
        userId,
        planId,
        stripePaymentIntentId: paymentIntentId,
        amountInCents: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'SUCCEEDED',
      },
      update: {
        status: 'SUCCEEDED',
      },
    });

    this.logger.log(`One-time payment recorded: ${paymentIntentId} for user ${userId}`);

    this.eventBus.emit(DOMAIN_EVENTS.PAYMENT_SUCCEEDED, {
      userId,
      planId,
      stripePaymentIntentId: paymentIntentId,
      amountInCents: session.amount_total ?? 0,
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INVOICE EVENTS (subscription renewals and failures)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Handles `invoice.paid` — a recurring payment succeeded.
   *
   * This fires every billing cycle (monthly/yearly). We update
   * the subscription's period dates and ensure the status is ACTIVE.
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = (invoice.parent?.subscription_details?.subscription as string) ?? null;
    if (!stripeSubscriptionId) return; // One-time invoice, not a subscription

    const subscription = await this.db.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(`Invoice paid for unknown subscription: ${stripeSubscriptionId}`);
      return;
    }

    // Fetch updated subscription from Stripe for current period dates
    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    const firstItem = stripeSub.items.data[0];

    await this.db.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: this.mapStripeStatus(stripeSub.status),
        currentPeriodStart: new Date(firstItem.current_period_start * 1000),
        currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
      },
    });

    this.logger.log(`Subscription renewed: ${stripeSubscriptionId}`);

    this.eventBus.emit(DOMAIN_EVENTS.SUBSCRIPTION_RENEWED, {
      userId: subscription.userId,
      planId: subscription.planId,
      stripeSubscriptionId,
    });
  }

  /**
   * Handles `invoice.payment_failed` — a recurring payment failed.
   *
   * The subscription moves to PAST_DUE. We still grant access
   * (it's in ACTIVE_SUBSCRIPTION_STATUSES) but the user should
   * update their payment method.
   *
   * Stripe automatically retries (Smart Retries). If all retries
   * fail, Stripe sends `customer.subscription.deleted` and we
   * cancel the subscription.
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = (invoice.parent?.subscription_details?.subscription as string) ?? null;
    if (!stripeSubscriptionId) return;

    const subscription = await this.db.subscription.findUnique({
      where: { stripeSubscriptionId },
      include: { user: { select: { email: true } } },
    });

    if (!subscription) {
      this.logger.warn(`Invoice failed for unknown subscription: ${stripeSubscriptionId}`);
      return;
    }

    await this.db.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: SUBSCRIPTION_STATUS.PAST_DUE },
    });

    this.logger.warn(`Payment failed for subscription: ${stripeSubscriptionId}`);

    this.eventBus.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
      userId: subscription.userId,
      planId: subscription.planId,
      stripeSubscriptionId,
      email: subscription.user.email,
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBSCRIPTION LIFECYCLE EVENTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Handles `customer.subscription.updated`.
   *
   * This fires when:
   * - User cancels (cancelAtPeriodEnd changes to true)
   * - User resumes (cancelAtPeriodEnd changes to false)
   * - Plan changes (upgrade/downgrade via Customer Portal)
   * - Status changes (trialing → active, etc.)
   */
  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const subscription = await this.db.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) {
      this.logger.warn(`Subscription updated for unknown: ${stripeSub.id}`);
      return;
    }

    // Resolve the planId from the Stripe price ID.
    // When a user changes plans via the Customer Portal, the price changes.
    const newPlanId = await this.resolvePlanId(stripeSub);

    const subItem = stripeSub.items.data[0];

    await this.db.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: this.mapStripeStatus(stripeSub.status),
        currentPeriodStart: new Date(subItem.current_period_start * 1000),
        currentPeriodEnd: new Date(subItem.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        canceledAt: stripeSub.canceled_at
          ? new Date(stripeSub.canceled_at * 1000)
          : null,
        // Update planId if the user changed plans via Customer Portal
        ...(newPlanId && { planId: newPlanId }),
      },
    });

    this.logger.log(
      `Subscription updated: ${stripeSub.id} → ${stripeSub.status}` +
      (stripeSub.cancel_at_period_end ? ' (canceling at period end)' : ''),
    );
  }

  /**
   * Handles `customer.subscription.deleted`.
   *
   * This fires when the subscription is fully canceled — either:
   * - The cancellation period ended
   * - All payment retries failed
   * - Admin canceled it immediately
   */
  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const subscription = await this.db.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) {
      this.logger.warn(`Subscription deleted for unknown: ${stripeSub.id}`);
      return;
    }

    await this.db.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status: SUBSCRIPTION_STATUS.CANCELED,
        canceledAt: new Date(),
      },
    });

    this.logger.log(`Subscription canceled: ${stripeSub.id} for user ${subscription.userId}`);

    this.eventBus.emit(DOMAIN_EVENTS.SUBSCRIPTION_CANCELED, {
      userId: subscription.userId,
      planId: subscription.planId,
      stripeSubscriptionId: stripeSub.id,
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Map Stripe's subscription status string to our SubscriptionStatus enum.
   *
   * Stripe uses lowercase strings; our DB uses uppercase enum values.
   */
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
      active: SUBSCRIPTION_STATUS.ACTIVE,
      past_due: SUBSCRIPTION_STATUS.PAST_DUE,
      canceled: SUBSCRIPTION_STATUS.CANCELED,
      unpaid: SUBSCRIPTION_STATUS.UNPAID,
      trialing: SUBSCRIPTION_STATUS.TRIALING,
      incomplete: SUBSCRIPTION_STATUS.INCOMPLETE,
      incomplete_expired: SUBSCRIPTION_STATUS.INCOMPLETE_EXPIRED,
      paused: SUBSCRIPTION_STATUS.PAUSED,
    };
    return mapping[stripeStatus] ?? SUBSCRIPTION_STATUS.ACTIVE;
  }

  /**
   * Resolve the Plan ID from a Stripe Subscription's current price.
   *
   * When a user changes plans via the Customer Portal, we need to
   * find which of our Plan records matches the new Stripe price.
   */
  private async resolvePlanId(stripeSub: Stripe.Subscription): Promise<string | null> {
    const firstItem = stripeSub.items?.data?.[0];
    if (!firstItem?.price?.id) return null;

    const plan = await this.db.plan.findUnique({
      where: { stripePriceId: firstItem.price.id },
    });

    return plan?.id ?? null;
  }
}
