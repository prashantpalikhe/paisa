/**
 * # Stripe Customer Service
 *
 * Manages the link between our User and Stripe's Customer object.
 *
 * ## Why lazy creation?
 *
 * We don't create a Stripe customer when a user registers — most users
 * may never pay. Instead, we create the customer the first time they
 * initiate a checkout. This keeps Stripe clean and avoids unnecessary
 * API calls during registration.
 *
 * ## Data model
 *
 * ```
 * Our DB:  User  ──1:1──  StripeCustomer  ──→  Stripe API: Customer
 *          (id)           (userId, stripeCustomerId)    (cus_xxx)
 * ```
 *
 * The StripeCustomer table is just a mapping between our userId and
 * Stripe's customer ID. We never store payment methods or card details.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Stripe } from '../stripe-types';
import { STRIPE_CLIENT } from '../stripe.constants';
import { DatabaseService } from '../../../core/database/database.service';

@Injectable()
export class StripeCustomerService {
  private readonly logger = new Logger(StripeCustomerService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Get or create a Stripe customer for the given user.
   *
   * 1. Check our DB for an existing mapping
   * 2. If found, return the Stripe customer ID
   * 3. If not found, create a new Stripe customer and save the mapping
   *
   * Uses Prisma `upsert` to handle the race condition where two
   * concurrent requests try to create a customer for the same user.
   * The unique constraint on `userId` ensures only one record exists.
   *
   * @returns The Stripe customer ID (e.g., "cus_xxx")
   */
  async getOrCreateCustomer(userId: string, email: string, name?: string | null): Promise<string> {
    // Check if we already have a Stripe customer for this user
    const existing = await this.db.stripeCustomer.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing.stripeCustomerId;
    }

    // Create a new customer in Stripe
    const customer = await this.stripe.customers.create({
      email,
      name: name ?? undefined,
      metadata: {
        // Store our internal userId in Stripe's metadata.
        // This helps when debugging in the Stripe Dashboard —
        // you can see which of our users this customer maps to.
        userId,
      },
    });

    // Save the mapping in our DB.
    // Use upsert to handle concurrent requests gracefully —
    // if another request already created the mapping, just return it.
    const record = await this.db.stripeCustomer.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customer.id,
      },
      update: {}, // Already exists — don't change anything
    });

    this.logger.log(`Stripe customer created: ${customer.id} for user ${userId}`);
    return record.stripeCustomerId;
  }

  /**
   * Get the Stripe customer ID for a user, if one exists.
   * Returns null if the user has never initiated a checkout.
   */
  async getCustomerId(userId: string): Promise<string | null> {
    const record = await this.db.stripeCustomer.findUnique({
      where: { userId },
    });
    return record?.stripeCustomerId ?? null;
  }

  /**
   * Update the email on the Stripe customer when a user changes their email.
   *
   * Called via EventBus listener (not directly by the user module,
   * because core modules don't import optional modules).
   */
  async updateCustomerEmail(userId: string, newEmail: string): Promise<void> {
    const record = await this.db.stripeCustomer.findUnique({
      where: { userId },
    });

    if (!record) return; // User has no Stripe customer — nothing to update

    await this.stripe.customers.update(record.stripeCustomerId, {
      email: newEmail,
    });

    this.logger.debug(`Stripe customer email updated for user ${userId}`);
  }
}
