/**
 * # Stripe Module
 *
 * Optional module for payments and subscriptions.
 * Only loaded when `FEATURE_STRIPE_ENABLED=true`.
 *
 * ## How it works
 *
 * ```
 * FEATURE_STRIPE_ENABLED=true
 *   → StripeModule.register() called in AppModule
 *   → Stripe SDK initialized with secretKey
 *   → Controllers registered (checkout, webhook, pricing, portal, admin)
 *   → Services registered (customer, checkout, subscription, product, webhook)
 * ```
 *
 * When disabled, none of this loads — no controllers, no services, no SDK.
 * The frontend hides billing UI via the `/config` endpoint flag.
 *
 * ## Module architecture
 *
 * ```
 * StripeModule
 *   ├── STRIPE_CLIENT (raw Stripe SDK instance)
 *   ├── services/
 *   │     ├── StripeCustomerService   (create/retrieve Stripe customers)
 *   │     ├── StripeCheckoutService   (create checkout sessions)
 *   │     ├── StripeSubscriptionService (query/cancel subscriptions)
 *   │     ├── StripeProductService    (admin CRUD for products/plans)
 *   │     └── StripeWebhookService    (process incoming webhook events)
 *   ├── controllers/
 *   │     ├── StripeCheckoutController  (POST /stripe/checkout)
 *   │     ├── StripeWebhookController   (POST /stripe/webhooks)
 *   │     ├── StripePricingController   (GET /stripe/pricing — public)
 *   │     ├── StripePortalController    (POST /stripe/portal)
 *   │     ├── StripeSubscriptionController (GET/POST subscription management)
 *   │     └── StripeAdminController     (admin product/plan CRUD)
 *   └── guards/
 *         └── SubscriptionGuard (route-level access check)
 * ```
 *
 * ## Cross-module communication
 *
 * This module communicates with core modules via EventBus only:
 * - Emits: SUBSCRIPTION_CREATED, SUBSCRIPTION_CANCELED, PAYMENT_SUCCEEDED, etc.
 * - Email module listens and sends billing notifications
 *
 * Per architectural rule: core modules NEVER import optional modules.
 */
import { DynamicModule, Module, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AppConfigService } from '../../core/config/config.service';
import { STRIPE_CLIENT } from './stripe.constants';
import { StripeCustomerService } from './services/stripe-customer.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';

@Module({})
export class StripeModule {
  private static readonly logger = new Logger(StripeModule.name);

  static register(): DynamicModule {
    return {
      module: StripeModule,
      providers: [
        // ─── Stripe SDK instance ───
        // Created once at module init, shared across all services.
        {
          provide: STRIPE_CLIENT,
          useFactory: (config: AppConfigService): Stripe => {
            const stripe = new Stripe(config.features.stripe.secretKey!, {
              // Pin the API version. Webhook payloads must match what we expect.
              // This must match the SDK's default (stripe v22 = 2026-03-25.dahlia).
              // Update this when upgrading Stripe SDK and after testing.
              apiVersion: '2026-03-25.dahlia',
              typescript: true,
            });

            StripeModule.logger.log('Stripe SDK initialized');
            return stripe;
          },
          inject: [AppConfigService],
        },

        // ─── Services ───
        StripeCustomerService,
        StripeWebhookService,
      ],

      controllers: [
        StripeWebhookController,
      ],

      exports: [
        STRIPE_CLIENT,
        StripeCustomerService,
      ],
    };
  }
}
