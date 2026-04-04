import { z } from 'zod';

/**
 * Shared Zod schemas for billing validation.
 */

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  active: z.boolean().default(true),
});

export const createCheckoutSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

export const createPlanSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(255),
  priceInCents: z.number().int().min(0),
  currency: z.string().length(3).default('usd'),
  interval: z.enum(['month', 'year', 'one_time']),
  intervalCount: z.number().int().min(1).default(1),
  trialDays: z.number().int().min(0).nullable().optional(),
  features: z.array(z.string()).default([]),
  highlighted: z.boolean().default(false),
  active: z.boolean().default(true),
});
