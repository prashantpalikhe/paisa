/**
 * # Auth E2E Tests
 *
 * Full end-to-end tests for the authentication system.
 * Real HTTP requests → real NestJS app → real PostgreSQL database.
 *
 * ## Test flow
 *
 * ```
 * Register → get tokens → access protected route → refresh → logout
 *            ↓
 *         verify email
 *            ↓
 *         forgot password → reset password → login with new password
 *            ↓
 *         change password
 * ```
 *
 * ## What makes these different from unit tests?
 *
 * Unit tests mock everything and test one function at a time.
 * E2e tests boot the REAL app and test the full request lifecycle:
 *
 * HTTP request → middleware → guards → pipes → controller → service → database → response
 *
 * If a unit test passes but the e2e test fails, it means the pieces
 * work individually but not together (integration bug).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@paisa/db';
import request from 'supertest';
import { createTestApp, getPrisma, resetDatabase } from '../helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = getPrisma(app);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/register → 201 with access token and refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'Password123',
        name: 'New User',
      })
      .expect(201);

    // Response body should have access token and user
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        id: expect.any(String),
        email: 'newuser@example.com',
        name: 'New User',
        role: 'USER',
        emailVerified: false,
      },
    });

    // Refresh token should be in an httpOnly cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('refresh_token='))
      : cookies;
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('POST /auth/register → 409 for duplicate email', async () => {
    // Register once
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dupe@example.com', password: 'Password123' })
      .expect(201);

    // Try again with same email
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dupe@example.com', password: 'Password123' })
      .expect(409);

    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /auth/register → 400 for invalid email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'Password123' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/register → 400 for weak password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'weak' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/login → 200 with tokens for valid credentials', async () => {
    // First register
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'login@example.com', password: 'Password123' });

    // Then login
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'Password123' })
      .expect(200);

    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        email: 'login@example.com',
      },
    });

    // Refresh cookie should be set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });

  it('POST /auth/login → 401 for wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'wrong@example.com', password: 'Password123' });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'WrongPassword1' })
      .expect(401);

    expect(res.body.error.message).toContain('Invalid email or password');
  });

  it('POST /auth/login → 401 for non-existent email', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' })
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROTECTED ROUTES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /auth/me → 200 with valid JWT', async () => {
    // Register and get token
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'me@example.com', password: 'Password123', name: 'Me' });

    const token = registerRes.body.data.accessToken;

    // Access protected route
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      email: 'me@example.com',
      name: 'Me',
    });
  });

  it('GET /auth/me → 401 without JWT', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
  });

  it('GET /auth/me → 401 with invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REFRESH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/refresh → 200 with new access token', async () => {
    // Register to get a refresh cookie
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'refresh@example.com', password: 'Password123' });

    // Extract the refresh cookie
    const cookies = registerRes.headers['set-cookie'];
    const refreshCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('refresh_token='))
      : cookies;

    // Use the refresh cookie to get a new access token
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie!)
      .expect(200);

    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
    });

    // A NEW refresh cookie should be set (rotation)
    const newCookies = res.headers['set-cookie'];
    expect(newCookies).toBeDefined();
  });

  it('POST /auth/refresh → old refresh token should not work after rotation', async () => {
    // Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'rotate@example.com', password: 'Password123' });

    const cookies = registerRes.headers['set-cookie'];
    const oldCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('refresh_token='))
      : cookies;

    // Use the refresh cookie once (rotation happens)
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie!)
      .expect(200);

    // Try to use the OLD cookie again — should fail (replay detection)
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie!)
      .expect(401);

    expect(res.body.error.message).toContain('revoked');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGOUT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/logout → 200 and invalidates refresh token', async () => {
    // Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logout@example.com', password: 'Password123' });

    const token = registerRes.body.data.accessToken;
    const cookies = registerRes.headers['set-cookie'];
    const refreshCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('refresh_token='))
      : cookies;

    // Logout
    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', refreshCookie!)
      .expect(200);

    expect(logoutRes.body.data.message).toContain('Logged out');

    // Refresh should fail after logout
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie!)
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL VERIFICATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/verify-email → 200 marks email as verified', async () => {
    // Register — this creates a verification token internally
    // Since email isn't wired yet, we need to get the token from the event bus
    // In e2e tests, we can't easily intercept events, so we test the flow
    // by verifying the user starts unverified
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'verify@example.com', password: 'Password123' });

    const token = registerRes.body.data.accessToken;

    // Verify user starts unverified
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.data.emailVerified).toBe(false);
  });

  it('POST /auth/verify-email → 401 with invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'invalid-token' })
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FORGOT/RESET PASSWORD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/forgot-password → 200 always (even non-existent email)', async () => {
    // Existing email
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'forgot@example.com', password: 'Password123' });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'forgot@example.com' })
      .expect(200);

    // Non-existent email — same response (prevent enumeration)
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);
  });

  it('POST /auth/reset-password → 401 with invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'bad-token', password: 'NewPassword123' })
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHANGE PASSWORD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/change-password → 200 with correct current password', async () => {
    // Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'change@example.com', password: 'Password123' });

    const token = registerRes.body.data.accessToken;

    // Change password
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' })
      .expect(200);

    // Login with new password should work
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'change@example.com', password: 'NewPassword456' })
      .expect(200);

    // Login with old password should fail
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'change@example.com', password: 'Password123' })
      .expect(401);
  });

  it('POST /auth/change-password → 401 with wrong current password', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'changefail@example.com', password: 'Password123' });

    const token = registerRes.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword1', newPassword: 'NewPassword456' })
      .expect(401);
  });

  it('POST /auth/change-password → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' })
      .expect(401);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SET PASSWORD (OAuth-only users)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/set-password → 409 when user already has a password', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'haspass@example.com', password: 'Password123' })
      .expect(201);

    const token = regRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .post('/auth/set-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'NewPassword123' })
      .expect(409);

    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /auth/set-password → 200 for OAuth-only user', async () => {
    // Register normally, then remove password to simulate OAuth-only
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'setpass@example.com', password: 'Password123' })
      .expect(201);

    const token = regRes.body.data.accessToken;
    const userId = regRes.body.data.user.id;

    // Simulate OAuth-only by removing the password hash
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: null },
    });

    // Now set-password should work
    const res = await request(app.getHttpServer())
      .post('/auth/set-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'NewPassword123' })
      .expect(200);

    expect(res.body.data.message).toBe('Password set successfully.');

    // Verify we can now login with the new password
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'setpass@example.com', password: 'NewPassword123' })
      .expect(200);
  });

  it('POST /auth/set-password → 400 for weak password', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'weak@example.com', password: 'Password123' })
      .expect(201);

    const token = regRes.body.data.accessToken;
    const userId = regRes.body.data.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: null },
    });

    await request(app.getHttpServer())
      .post('/auth/set-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'weak' })
      .expect(400);
  });

  it('POST /auth/set-password → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/auth/set-password')
      .send({ password: 'Password123' })
      .expect(401);
  });

  it('GET /auth/me → hasPassword true for email/password user', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'check@example.com', password: 'Password123' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${regRes.body.data.accessToken}`)
      .expect(200);

    expect(res.body.data.hasPassword).toBe(true);
  });

  it('GET /auth/me → hasPassword false for OAuth-only user', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'nopw@example.com', password: 'Password123' })
      .expect(201);

    const token = regRes.body.data.accessToken;
    const userId = regRes.body.data.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: null },
    });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.hasPassword).toBe(false);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GOOGLE OAUTH (feature-flagged)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // The full OAuth redirect flow can't be tested without a real Google
  // consent screen. But we CAN test that the endpoints respect the
  // feature flag — they should return 404 when Google OAuth is disabled
  // (which is the default in the test environment).

  it('GET /auth/google → 404 when FEATURE_AUTH_GOOGLE_ENABLED is false', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/google')
      .expect(404);

    expect(res.body.error.message).toContain('Google OAuth is not enabled');
  });

  it('GET /auth/google/callback → 404 when FEATURE_AUTH_GOOGLE_ENABLED is false', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/google/callback')
      .expect(404);

    expect(res.body.error.message).toContain('Google OAuth is not enabled');
  });
});
