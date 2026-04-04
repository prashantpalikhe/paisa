/**
 * # Stripe Billing Portal Service
 *
 * Creates Stripe Billing Portal sessions for self-service billing management.
 *
 * ## What is the Billing Portal?
 *
 * Stripe's hosted page where customers can:
 * - View and download invoices
 * - Update payment methods
 * - Cancel or change their subscription plan
 * - View billing history
 *
 * Like Checkout, this is a hosted Stripe page — we redirect to it,
 * and Stripe redirects back when the customer is done.
 *
 * ## Portal Configuration
 *
 * The portal's features (which actions are allowed) are configured
 * in the Stripe Dashboard under Settings → Billing → Customer portal.
 * We don't configure it via API — it's a one-time dashboard setup.
 */
import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Stripe } from '../stripe-types';
import { STRIPE_CLIENT } from '../stripe.constants';
import { AppConfigService } from '../../../core/config/config.service';
import { StripeCustomerService } from './stripe-customer.service';

@Injectable()
export class StripePortalService {
  private readonly logger = new Logger(StripePortalService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly config: AppConfigService,
    private readonly customerService: StripeCustomerService,
  ) {}

  /**
   * Create a Billing Portal session.
   *
   * Returns a URL that the frontend redirects to.
   * After the customer finishes, Stripe redirects them back to `return_url`.
   *
   * @param userId - The authenticated user's ID
   * @returns The Stripe Billing Portal URL
   */
  async createPortalSession(userId: string): Promise<{ url: string }> {
    // User must have a Stripe customer to access the portal
    const stripeCustomerId = await this.customerService.getCustomerId(userId);

    if (!stripeCustomerId) {
      throw new NotFoundException(
        'No billing account found. You need to make a purchase first.',
      );
    }

    const frontendUrl = this.config.env.FRONTEND_URL;

    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${frontendUrl}/billing`,
    });

    this.logger.log(`Portal session created for user ${userId}`);

    return { url: session.url };
  }
}
