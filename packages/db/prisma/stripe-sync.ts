/**
 * # Stripe Sync Script
 *
 * Creates products and prices in Stripe from your database records,
 * then updates the database with the real Stripe IDs.
 *
 * ## When to run
 *
 * After seeding the database (`pnpm --filter @paisa/db db:seed`), run this
 * script to sync the seeded products/plans to your Stripe account:
 *
 * ```bash
 * pnpm --filter @paisa/db stripe:sync
 * ```
 *
 * ## What it does
 *
 * 1. Reads all products and plans from the database
 * 2. For each product: creates (or finds) a Stripe Product
 * 3. For each plan: creates (or finds) a Stripe Price
 * 4. Updates the database records with the real Stripe IDs
 *
 * ## Idempotent
 *
 * If a product/plan already has a real Stripe ID (starts with `prod_` / `price_`
 * and not `prod_seed_` / `price_seed_`), it's skipped.
 * Safe to run multiple times.
 *
 * ## Requirements
 *
 * - STRIPE_SECRET_KEY must be set in .env
 * - Database must be seeded first
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─── Load env from monorepo root ───
function findRoot(dir: string): string | null {
  dir = path.resolve(dir);
  const fsRoot = path.parse(dir).root;
  while (dir !== fsRoot) {
    if (fs.existsSync(path.join(dir, 'turbo.json'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

const root = findRoot(process.cwd());
if (root) {
  dotenv.config({ path: path.join(root, '.env.local') });
  dotenv.config({ path: path.join(root, '.env') });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey || stripeSecretKey.startsWith('sk_test_fake')) {
  throw new Error(
    'STRIPE_SECRET_KEY must be set to a real Stripe test key.\n' +
    'Get yours at: https://dashboard.stripe.com/test/apikeys',
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const stripe = new (Stripe as any)(stripeSecretKey);

/**
 * Check if an ID is a placeholder (seed value) that needs syncing.
 */
function isPlaceholder(id: string | null): boolean {
  if (!id) return true;
  return id.startsWith('prod_seed_') || id.startsWith('price_seed_') || id.startsWith('price_sample_');
}

async function main() {
  console.log('🔄 Syncing products and plans to Stripe...\n');

  // 1. Get all products with their plans
  const products = await prisma.product.findMany({
    include: { plans: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (products.length === 0) {
    console.log('No products found. Run db:seed first.');
    return;
  }

  for (const product of products) {
    // ─── Sync Product ───
    let stripeProductId = product.stripeProductId;

    if (isPlaceholder(stripeProductId)) {
      console.log(`📦 Creating Stripe product: ${product.name}`);

      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description ?? undefined,
        metadata: { paisaProductId: product.id },
      });

      stripeProductId = stripeProduct.id;

      await prisma.product.update({
        where: { id: product.id },
        data: { stripeProductId },
      });

      console.log(`   ✓ Created: ${stripeProductId}`);
    } else {
      console.log(`📦 Product "${product.name}" already synced: ${stripeProductId}`);
    }

    // ─── Sync Plans (Prices) ───
    for (const plan of product.plans) {
      if (!isPlaceholder(plan.stripePriceId)) {
        console.log(`   💰 Plan "${plan.name}" already synced: ${plan.stripePriceId}`);
        continue;
      }

      console.log(`   💰 Creating Stripe price: ${plan.name} (${plan.priceInCents}¢/${plan.interval})`);

      const priceParams: any = {
        product: stripeProductId,
        unit_amount: plan.priceInCents,
        currency: plan.currency,
        metadata: { paisaPlanId: plan.id },
      };

      if (plan.interval !== 'one_time') {
        priceParams.recurring = {
          interval: plan.interval,
          interval_count: plan.intervalCount,
        };
      }

      const stripePrice = await stripe.prices.create(priceParams);

      await prisma.plan.update({
        where: { id: plan.id },
        data: { stripePriceId: stripePrice.id },
      });

      console.log(`      ✓ Created: ${stripePrice.id}`);
    }

    console.log('');
  }

  console.log('✅ Stripe sync complete!\n');
  console.log('Your products and prices are now live in Stripe test mode.');
  console.log('View them at: https://dashboard.stripe.com/test/products');
}

main()
  .catch((e) => {
    console.error('❌ Stripe sync failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
