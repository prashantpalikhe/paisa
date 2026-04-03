/**
 * # Playwright Global Setup
 *
 * Runs ONCE before all Playwright tests. Ensures:
 * 1. The test database (postgres-test, port 5433) is accepting connections
 * 2. Prisma migrations are applied to the test database
 *
 * This mirrors the pattern from `apps/api/test/setup/global-setup.ts`
 * used by the API's Vitest e2e tests.
 */
import { execSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'

const TEST_DB_URL = 'postgresql://paisa_test:paisa_test@localhost:5433/paisa_test'
const TEST_DB_HOST = 'localhost'
const TEST_DB_PORT = 5433

/**
 * Wait for a TCP port to accept connections.
 * Retries every 500ms until timeout.
 */
async function waitForPort(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.destroy()
          resolve()
        })
        socket.on('error', reject)
        socket.setTimeout(1000, () => {
          socket.destroy()
          reject(new Error('timeout'))
        })
      })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  throw new Error(
    `Database at ${host}:${port} not ready after ${timeoutMs}ms.\n` +
    'Is postgres-test running? Run: docker compose -f docker/docker-compose.yml up -d postgres-test',
  )
}

export default async function globalSetup() {
  console.log('\n🎭 Playwright Global Setup')
  console.log(`   Database: ${TEST_DB_URL.replace(/\/\/.*@/, '//***@')}`)

  // 1. Wait for postgres-test to be ready
  console.log(`   Waiting for ${TEST_DB_HOST}:${TEST_DB_PORT}...`)
  await waitForPort(TEST_DB_HOST, TEST_DB_PORT)
  console.log('   ✓ Database is accepting connections')

  // 2. Run Prisma migrations
  const dbPackagePath = path.resolve(__dirname, '../packages/db')

  try {
    execSync('npx prisma migrate deploy', {
      cwd: dbPackagePath,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DB_URL,
      },
      stdio: 'pipe',
    })
    console.log('   ✓ Migrations applied')
  } catch (error) {
    const err = error as { stderr?: Buffer }
    console.error('   ✗ Migration failed:', err.stderr?.toString())
    throw error
  }

  // 3. Build workspace packages (config, shared) so imports resolve
  try {
    execSync('pnpm --filter @paisa/config build && pnpm --filter @paisa/shared build', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
    })
    console.log('   ✓ Workspace packages built')
  } catch (error) {
    const err = error as { stderr?: Buffer }
    console.error('   ✗ Package build failed:', err.stderr?.toString())
    throw error
  }

  console.log('   ✓ Setup complete\n')
}
