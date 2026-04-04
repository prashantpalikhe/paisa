/**
 * # Database Seed Script
 *
 * Creates initial data for development:
 * - Admin user (no password — set via auth module or API)
 * - Starter and Pro products with monthly/yearly plans
 * - Feature flags for maintenance mode and beta signups
 *
 * ## Usage
 *
 * ```bash
 * pnpm --filter @paisa/db db:seed
 * ```
 *
 * ## Why upsert?
 *
 * We use upsert() instead of create() so this script is idempotent —
 * you can run it multiple times without duplicating data.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Load .env from the monorepo root.
// Same self-contained approach as prisma.config.ts — seed runs before builds.
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
  throw new Error('DATABASE_URL is required for seeding');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Admin user ───
  // Password: "Admin123!" — change immediately in production
  // This hash is for development/testing only
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      // Password hash will be set by the auth module during first setup
      // For now, we create the user without a password (OAuth or set later)
      passwordHash: null,
    },
  });

  console.log(`  ✓ Admin user: ${adminUser.email} (${adminUser.id})`);

  // ─── Products + plans ───

  // Product 1: Starter
  const starterProduct = await prisma.product.upsert({
    where: { id: 'seed-product-starter' },
    update: {},
    create: {
      id: 'seed-product-starter',
      name: 'Starter',
      description: 'Everything you need to get started',
      active: true,
      stripeProductId: 'prod_seed_starter',
      sortOrder: 1,
    },
  });

  console.log(`  ✓ Product: ${starterProduct.name} (${starterProduct.id})`);

  const starterFeatures = [
    'Up to 3 projects',
    'Basic analytics',
    'Email support',
  ];

  const starterMonthly = await prisma.plan.upsert({
    where: { stripePriceId: 'price_seed_starter_monthly' },
    update: {},
    create: {
      productId: starterProduct.id,
      id: 'seed-plan-starter-monthly',
      name: 'Monthly',
      stripePriceId: 'price_seed_starter_monthly',
      priceInCents: 900,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      features: starterFeatures,
      highlighted: false,
      active: true,
      sortOrder: 0,
    },
  });

  const starterYearly = await prisma.plan.upsert({
    where: { stripePriceId: 'price_seed_starter_yearly' },
    update: {},
    create: {
      productId: starterProduct.id,
      id: 'seed-plan-starter-yearly',
      name: 'Yearly',
      stripePriceId: 'price_seed_starter_yearly',
      priceInCents: 9000,
      currency: 'usd',
      interval: 'year',
      intervalCount: 1,
      features: starterFeatures,
      highlighted: false,
      active: true,
      sortOrder: 1,
    },
  });

  console.log(
    `  ✓ Starter plans: ${starterMonthly.name} ($9/mo), ${starterYearly.name} ($90/yr)`,
  );

  // Product 2: Pro
  const proProduct = await prisma.product.upsert({
    where: { id: 'seed-product-pro' },
    update: {},
    create: {
      id: 'seed-product-pro',
      name: 'Pro',
      description: 'For growing teams and businesses',
      active: true,
      stripeProductId: 'prod_seed_pro',
      sortOrder: 2,
    },
  });

  console.log(`  ✓ Product: ${proProduct.name} (${proProduct.id})`);

  const proFeatures = [
    'Unlimited projects',
    'Advanced analytics',
    'Priority support',
    'API access',
    'Custom integrations',
  ];

  const proMonthly = await prisma.plan.upsert({
    where: { stripePriceId: 'price_seed_pro_monthly' },
    update: {},
    create: {
      productId: proProduct.id,
      id: 'seed-plan-pro-monthly',
      name: 'Monthly',
      stripePriceId: 'price_seed_pro_monthly',
      priceInCents: 2900,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      features: proFeatures,
      highlighted: false,
      active: true,
      sortOrder: 0,
    },
  });

  const proYearly = await prisma.plan.upsert({
    where: { stripePriceId: 'price_seed_pro_yearly' },
    update: {},
    create: {
      productId: proProduct.id,
      id: 'seed-plan-pro-yearly',
      name: 'Yearly',
      stripePriceId: 'price_seed_pro_yearly',
      priceInCents: 29000,
      currency: 'usd',
      interval: 'year',
      intervalCount: 1,
      features: proFeatures,
      highlighted: true,
      active: true,
      sortOrder: 1,
    },
  });

  console.log(
    `  ✓ Pro plans: ${proMonthly.name} ($29/mo), ${proYearly.name} ($290/yr)`,
  );

  // ─── Sample business feature flags ───
  const flags = [
    {
      key: 'maintenance_mode',
      enabled: false,
      description: 'Show maintenance page to all users',
    },
    {
      key: 'beta_signups',
      enabled: true,
      description: 'Allow new user registrations',
    },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }

  console.log(`  ✓ Feature flags: ${flags.map((f) => f.key).join(', ')}`);

  console.log('✅ Seeding complete');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
