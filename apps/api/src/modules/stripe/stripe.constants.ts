/**
 * # Stripe Constants
 *
 * Injection tokens and configuration constants for the Stripe module.
 *
 * ## Why injection tokens?
 *
 * NestJS DI uses tokens to look up providers. For classes, the class
 * itself is the token. But for non-class values (like an SDK instance),
 * we need a Symbol or string. Using Symbol guarantees uniqueness.
 */

/** Injection token for the initialized Stripe SDK instance */
export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

/**
 * Stripe webhook events we handle.
 *
 * Only list events we actually process — ignore the rest.
 * This also serves as documentation of what our webhook endpoint expects.
 */
export const HANDLED_STRIPE_EVENTS = [
  // Checkout completed → create Subscription or Payment record
  'checkout.session.completed',

  // Recurring invoice paid → renew subscription period
  'invoice.paid',

  // Recurring invoice failed → mark subscription past_due
  'invoice.payment_failed',

  // Subscription updated → sync status, plan changes, cancellation
  'customer.subscription.updated',

  // Subscription deleted → mark as canceled
  'customer.subscription.deleted',
] as const;

export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number];
