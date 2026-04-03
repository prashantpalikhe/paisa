/**
 * # Product & Plan Factories
 *
 * Creates Product and Plan records for testing billing flows.
 *
 * ## Usage
 *
 * ```typescript
 * const product = await createProduct(prisma);
 * const plan = await createPlan(prisma, { productId: product.id });
 * ```
 */
import { PrismaClient } from '@paisa/db';
import type { Product, Plan } from '@paisa/db';

let productCounter = 0;
let planCounter = 0;

export function resetProductCounters(): void {
  productCounter = 0;
  planCounter = 0;
}

export interface CreateProductOptions {
  id?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export async function createProduct(
  prisma: PrismaClient,
  overrides: CreateProductOptions = {},
): Promise<Product> {
  productCounter++;

  return prisma.product.create({
    data: {
      id: overrides.id ?? `test-product-${productCounter}`,
      name: overrides.name ?? `Test Product ${productCounter}`,
      description: overrides.description ?? 'A test product',
      active: overrides.active ?? true,
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

export interface CreatePlanOptions {
  productId: string; // Required — a plan always belongs to a product
  name?: string;
  stripePriceId?: string;
  priceInCents?: number;
  currency?: string;
  interval?: string;
  intervalCount?: number;
  trialDays?: number | null;
  features?: unknown[];
  highlighted?: boolean;
  active?: boolean;
  sortOrder?: number;
}

export async function createPlan(
  prisma: PrismaClient,
  overrides: CreatePlanOptions,
): Promise<Plan> {
  planCounter++;

  return prisma.plan.create({
    data: {
      productId: overrides.productId,
      name: overrides.name ?? `Test Plan ${planCounter}`,
      stripePriceId:
        overrides.stripePriceId ?? `price_test_${planCounter}`,
      priceInCents: overrides.priceInCents ?? 999,
      currency: overrides.currency ?? 'usd',
      interval: overrides.interval ?? 'month',
      intervalCount: overrides.intervalCount ?? 1,
      trialDays: overrides.trialDays ?? null,
      features: (overrides.features ?? ['Feature A', 'Feature B']) as any,
      highlighted: overrides.highlighted ?? false,
      active: overrides.active ?? true,
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}
