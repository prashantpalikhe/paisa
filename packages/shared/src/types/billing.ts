/**
 * Billing/subscription types shared between frontend and backend.
 */

export interface Product {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  plans: Plan[];
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  priceInCents: number;
  currency: string;
  interval: PlanInterval;
  intervalCount: number;
  trialDays: number | null;
  features: string[];
  highlighted: boolean;
  active: boolean;
}

export type PlanInterval = 'month' | 'year' | 'one_time';

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'TRIALING'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';
