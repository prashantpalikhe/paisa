/**
 * # Stripe Checkout Service
 *
 * Creates Stripe Checkout Sessions for both one-time payments and subscriptions.
 *
 * ## How Stripe Checkout works
 *
 * Instead of building a custom payment form (which requires PCI compliance),
 * we redirect the user to Stripe's hosted Checkout page. Stripe handles:
 * - Card input and validation
 * - Apple Pay, Google Pay, bank transfers
 * - 3D Secure authentication
 * - Tax calculation (if configured)
 * - Receipt emails
 *
 * After payment, Stripe redirects the user back to our success/cancel URL.
 * But we NEVER trust that redirect — the webhook is what actually creates
 * the subscription/payment in our database.
 *
 * ## Flow
 *
 * ```
 * 1. User clicks "Buy" on pricing page
 * 2. Frontend calls POST /stripe/checkout { planId: "..." }
 * 3. This service:
 *    a. Looks up the Plan in our DB
 *    b. Gets/creates a Stripe Customer for the user
 *    c. Creates a Checkout Session with the right mode (payment vs subscription)
 *    d. Returns the Checkout URL
 * 4. Frontend redirects to the Stripe URL
 * 5. User pays on Stripe
 * 6. Stripe redirects to our success page (cosmetic only)
 * 7. Stripe sends webhook → our WebhookService creates the record
 * ```
 */
import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Stripe } from '../stripe-types';
import { STRIPE_CLIENT } from '../stripe.constants';
import { DatabaseService } from '../../../core/database/database.service';
import { AppConfigService } from '../../../core/config/config.service';
import { StripeCustomerService } from './stripe-customer.service';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '@paisa/shared';

@Injectable()
export class StripeCheckoutService {
  private readonly logger = new Logger(StripeCheckoutService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly db: DatabaseService,
    private readonly config: AppConfigService,
    private readonly customerService: StripeCustomerService,
  ) {}

  /**
   * Create a Stripe Checkout Session.
   *
   * Determines the mode (subscription vs payment) from the Plan's interval.
   * Returns the Checkout URL that the frontend redirects to.
   *
   * @param userId - The authenticated user's ID
   * @param email - The user's email
   * @param name - The user's name (optional, for Stripe customer)
   * @param planId - Our internal Plan ID (not the Stripe price ID)
   * @returns The Stripe Checkout URL
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    name: string | null,
    planId: string,
  ): Promise<{ url: string }> {
    // 1. Look up the plan in our database
    const plan = await this.db.plan.findUnique({
      where: { id: planId },
      include: { product: true },
    });

    if (!plan || !plan.active || !plan.product.active) {
      throw new NotFoundException('Plan not found or inactive');
    }

    // 2. For subscriptions, check if user already has an active one for this product
    if (plan.interval !== 'one_time') {
      const existingSub = await this.db.subscription.findFirst({
        where: {
          userId,
          plan: { productId: plan.productId },
          status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
        },
      });

      if (existingSub) {
        throw new ConflictException(
          'You already have an active subscription for this product. ' +
          'Use the billing portal to change your plan.',
        );
      }
    }

    // 3. Get or create a Stripe customer
    const stripeCustomerId = await this.customerService.getOrCreateCustomer(
      userId,
      email,
      name,
    );

    // 4. Determine checkout mode based on plan interval
    const isSubscription = plan.interval !== 'one_time';
    const frontendUrl = this.config.env.FRONTEND_URL;

    // 5. Create the Stripe Checkout Session
    const sessionParams = {
      customer: stripeCustomerId,
      mode: (isSubscription ? 'subscription' : 'payment') as 'subscription' | 'payment',
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      // These URLs are where Stripe redirects after checkout.
      // {CHECKOUT_SESSION_ID} is replaced by Stripe with the actual session ID.
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/checkout/cancel`,
      // Store our IDs in metadata so the webhook can link the payment
      // back to the right user and plan. This is critical.
      metadata: {
        userId,
        planId,
      },
      // For subscriptions, also attach metadata to the subscription itself
      // so we can access it in subscription.updated/deleted webhooks.
      ...(isSubscription && {
        subscription_data: {
          metadata: {
            userId,
            planId,
          },
          // Apply trial days if the plan has them
          ...(plan.trialDays && { trial_period_days: plan.trialDays }),
        },
      }),
    };

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    this.logger.log(
      `Checkout session created: ${session.id} ` +
      `(${isSubscription ? 'subscription' : 'one-time'}) ` +
      `for user ${userId}, plan ${planId}`,
    );

    return { url: session.url };
  }
}
