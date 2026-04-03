/**
 * # Health Endpoint E2E Tests
 *
 * Tests the GET /health endpoint against a real NestJS app
 * connected to a real PostgreSQL database.
 *
 * ## Pattern established here
 *
 * Every e2e test file follows this structure:
 *
 * 1. `beforeAll` — boot the app, get the Prisma client
 * 2. `beforeEach` — reset the database (clean slate per test)
 * 3. Tests — use supertest for HTTP, factories for test data
 * 4. `afterAll` — shut down the app (closes DB connection)
 *
 * Even though the health endpoint doesn't need test data,
 * we include `resetDatabase` to establish the pattern for
 * future test files that copy this structure.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@paisa/db';
import request from 'supertest';
import { createTestApp, getPrisma, resetDatabase } from '../helpers';

describe('Health (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = getPrisma(app);
  });

  beforeEach(async () => {
    // Clean slate for every test — even if this suite doesn't write data,
    // we include this to establish the pattern for all e2e test files.
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Happy path ──

  it('GET /health → 200 with full health status', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    // Health endpoint returns raw response (not wrapped in { data })
    // because the ResponseTransformInterceptor skips /health
    expect(response.body).toMatchObject({
      status: 'ok',
      checks: {
        database: true,
      },
      // Feature flags are env-dependent — just check the keys exist.
      // Don't hardcode true/false since .env may change between runs.
      features: expect.objectContaining({
        email: expect.any(Boolean),
        stripe: expect.any(Boolean),
        redis: expect.any(Boolean),
        rabbitmq: expect.any(Boolean),
        storage: expect.any(Boolean),
        websockets: expect.any(Boolean),
        sentry: expect.any(Boolean),
      }),
    });

    // Verify structural fields
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  // ── Error handling ──

  it('GET /nonexistent → 404 with standard error shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/nonexistent')
      .expect(404);

    // All errors follow { error: { code, message } } shape.
    // This proves the GlobalExceptionFilter is wired up correctly.
    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  // ── Security headers ──

  it('should include security headers from Helmet', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    // Helmet sets these headers. Verifying they exist proves
    // configureApp() is applying Helmet correctly in tests.
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
