/**
 * # E2E Global Setup
 *
 * Runs ONCE before all e2e test files. Responsible for:
 *
 * 1. Waiting for the test database to be ready (handles slow Docker starts)
 * 2. Pointing DATABASE_URL at the test database
 * 3. Running Prisma migrations so the test DB has the latest schema
 *
 * ## Why a global setup?
 *
 * Migrations are slow (~2-5s). Running them once before all tests
 * is much faster than running them before each test file.
 * Individual test files use `resetDatabase()` (fast table truncation)
 * to get a clean slate without re-running migrations.
 *
 * ## How Vitest global setup works
 *
 * Vitest calls the default export function before any tests run.
 * If it returns a teardown function, that runs after all tests finish.
 * See: https://vitest.dev/config/#globalsetup
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';

/**
 * Wait for a TCP port to accept connections.
 * Used to ensure Postgres is ready before running migrations.
 *
 * Why not `pg_isready`? It requires the `postgresql-client` package
 * to be installed, which isn't guaranteed. A raw TCP check is
 * dependency-free and works everywhere.
 */
async function waitForPort(
  host: string,
  port: number,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', reject);
        socket.setTimeout(1000, () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
      });
      return; // Connected successfully
    } catch {
      // Not ready yet — wait 500ms and retry
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error(
    `Database at ${host}:${port} not ready after ${timeoutMs}ms. ` +
      'Is the postgres-test Docker container running? ' +
      'Run: docker compose -f docker/docker-compose.yml up -d postgres-test',
  );
}

export default async function globalSetup() {
  // ── 1. Resolve the test database URL ──
  const testDatabaseUrl =
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    'postgresql://paisa_test:paisa_test@localhost:5433/paisa_test';

  // Override DATABASE_URL for the entire test process.
  // When the NestJS app boots inside tests, DatabaseService reads
  // process.env.DATABASE_URL — so this ensures it connects to the test DB.
  process.env.DATABASE_URL = testDatabaseUrl;

  console.log('\n🧪 E2E Global Setup');
  console.log(`   Database: ${testDatabaseUrl.replace(/\/\/.*@/, '//***@')}`);

  // ── 2. Wait for Postgres to be ready ──
  // In CI or after a fresh `docker compose up`, the container may
  // still be initializing. This avoids cryptic connection errors.
  const url = new URL(testDatabaseUrl);
  const host = url.hostname;
  const port = parseInt(url.port, 10) || 5432;

  console.log(`   Waiting for ${host}:${port}...`);
  await waitForPort(host, port);
  console.log('   ✓ Database is accepting connections');

  // ── 3. Run Prisma migrations ──
  // `prisma migrate deploy` is the production-safe command — it only
  // applies existing migration files, never creates new ones.
  // We use process.cwd() (the api app directory) to resolve the path,
  // which is more resilient than __dirname-relative paths.
  const dbPackagePath = path.resolve(process.cwd(), '../../packages/db');

  try {
    execSync('npx prisma migrate deploy', {
      cwd: dbPackagePath,
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
      },
      stdio: 'pipe', // Capture output instead of printing verbose Prisma logs
    });
    console.log('   ✓ Migrations applied');
  } catch (error) {
    const err = error as { stderr?: Buffer };
    console.error('   ✗ Migration failed:', err.stderr?.toString());
    throw error;
  }

  console.log('   ✓ Setup complete\n');

  // ── 4. Return teardown function ──
  return async () => {
    console.log('\n🧹 E2E Global Teardown — done');
  };
}
