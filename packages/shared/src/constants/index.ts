/**
 * Shared constants used across frontend and backend.
 */

/** User roles */
export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

/** Subscription statuses */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  UNPAID: 'UNPAID',
  TRIALING: 'TRIALING',
  INCOMPLETE: 'INCOMPLETE',
  INCOMPLETE_EXPIRED: 'INCOMPLETE_EXPIRED',
  PAUSED: 'PAUSED',
} as const;

/** Subscription statuses that grant access */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.TRIALING,
  SUBSCRIPTION_STATUS.PAST_DUE, // grace period
] as const;

/** OAuth providers */
export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
} as const;

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const;

/** Domain events emitted by core modules, consumed by optional modules */
export const DOMAIN_EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_VERIFICATION_RESENT: 'user.verification_resent',
  USER_VERIFIED_EMAIL: 'user.verified_email',
  USER_LOGGED_IN: 'user.logged_in',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  USER_OAUTH_LINKED: 'user.oauth_linked',
} as const;
