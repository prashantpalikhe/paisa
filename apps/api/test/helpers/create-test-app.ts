/**
 * # Test App Factory
 *
 * Creates a fully configured NestJS application for e2e testing.
 * Uses the same `configureApp()` as production (`main.ts`), so
 * middleware, security, filters, and interceptors are always in sync.
 *
 * ## What's different from production?
 *
 * - No Pino logger (LOG_LEVEL=silent suppresses output)
 * - No Swagger/Scalar (not needed for tests)
 * - No `app.listen()` (supertest handles HTTP directly)
 *
 * Everything else — Helmet, cookie-parser, CORS, filters, interceptors —
 * is identical to production via `configureApp()`.
 *
 * ## Usage
 *
 * ```typescript
 * import { createTestApp } from '../helpers';
 *
 * let app: INestApplication;
 *
 * beforeAll(async () => {
 *   app = await createTestApp();
 * });
 *
 * afterAll(async () => {
 *   await app.close();
 * });
 * ```
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';

export async function createTestApp(): Promise<INestApplication> {
  // ── 1. Compile the full AppModule with all real providers ──
  // No mocks — that's what makes this an e2e test.
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // ── 2. Create the HTTP application ──
  const app = moduleFixture.createNestApplication();

  // ── 3. Apply the SAME configuration as production ──
  // This is the key: configureApp() is shared with main.ts.
  // If someone adds a new global middleware, both get it automatically.
  configureApp(app);

  // ── 4. Initialize ──
  // Triggers onModuleInit() on all providers (e.g., DatabaseService.$connect())
  await app.init();

  return app;
}
