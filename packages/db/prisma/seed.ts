import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

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
    where: { email: 'admin@paisa.dev' },
    update: {},
    create: {
      email: 'admin@paisa.dev',
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

  // ─── Sample product + plans ───
  const product = await prisma.product.upsert({
    where: { id: 'sample-product' },
    update: {},
    create: {
      id: 'sample-product',
      name: 'Pro Plan',
      description: 'Full access to all features',
      active: true,
      sortOrder: 0,
    },
  });

  console.log(`  ✓ Product: ${product.name} (${product.id})`);

  const monthlyPlan = await prisma.plan.upsert({
    where: { stripePriceId: 'price_sample_monthly' },
    update: {},
    create: {
      productId: product.id,
      name: 'Monthly',
      stripePriceId: 'price_sample_monthly',
      priceInCents: 999,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      features: ['All features', 'Priority support', 'No ads'],
      highlighted: true,
      active: true,
      sortOrder: 0,
    },
  });

  const yearlyPlan = await prisma.plan.upsert({
    where: { stripePriceId: 'price_sample_yearly' },
    update: {},
    create: {
      productId: product.id,
      name: 'Yearly',
      stripePriceId: 'price_sample_yearly',
      priceInCents: 9990,
      currency: 'usd',
      interval: 'year',
      intervalCount: 1,
      trialDays: 14,
      features: ['All features', 'Priority support', 'No ads', '2 months free'],
      highlighted: false,
      active: true,
      sortOrder: 1,
    },
  });

  console.log(`  ✓ Plans: ${monthlyPlan.name}, ${yearlyPlan.name}`);

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
