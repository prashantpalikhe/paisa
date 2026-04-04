/**
 * # Stripe Type Helpers
 *
 * Stripe SDK v22 CJS entry exports a constructor function (`StripeConstructor`),
 * not the `Stripe` class directly. This means:
 *
 * - `import Stripe from 'stripe'` → gives you `StripeConstructor` (a function)
 * - You CANNOT use `Stripe` as a type annotation (it's a value, not a type)
 * - You CANNOT access namespace types like `Stripe.Event` or `Stripe.Checkout.Session`
 *
 * The actual `Stripe` class and its namespace types live in `stripe/cjs/stripe.core.js`.
 * This file re-exports them so the rest of our code has clean type access.
 *
 * ## Usage
 *
 * ```typescript
 * // ❌ WRONG — Stripe is the constructor function, not the class
 * import Stripe from 'stripe';
 * private readonly stripe: Stripe; // Error: Cannot use namespace as type
 * const event: Stripe.Event; // Error: Namespace has no exported member 'Event'
 *
 * // ✅ CORRECT — Import from our type helper
 * import type { Stripe } from '../stripe-types';
 * private readonly stripe: Stripe;
 * const event: Stripe.Event;
 * ```
 */
export type { Stripe } from 'stripe/cjs/stripe.core.js';
