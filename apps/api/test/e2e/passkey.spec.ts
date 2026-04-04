/**
 * # Passkey E2E Tests
 *
 * Tests for passkey (WebAuthn) API endpoints.
 *
 * Note: Full registration/authentication ceremonies can't be tested end-to-end
 * because they require a real browser WebAuthn API. These tests verify:
 * - Registration options are generated correctly
 * - Authentication options are generated correctly
 * - Passkey CRUD (list, rename, delete) works
 * - Auth requirements (protected vs public endpoints)
 * - hasPasskey flag in user profile
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@paisa/db';
import request from 'supertest';
import { createTestApp, getPrisma, resetDatabase } from '../helpers';

describe('Passkey (e2e)', () => {
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

  // ── Helper: register a user and get tokens ──
  async function registerUser(
    email = 'test@example.com',
    password = 'Password123',
    name = 'Test User',
  ) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name })
      .expect(201);

    return {
      accessToken: res.body.data.accessToken,
      userId: res.body.data.user.id,
      cookies: res.headers['set-cookie'],
    };
  }

  // ── Helper: create a passkey directly in DB ──
  async function createPasskeyInDb(userId: string, deviceName = 'Test Passkey') {
    // credentialId must be valid base64url — generate random bytes and encode
    const randomBytes = Buffer.from(
      Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
    );
    const credentialId = randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return prisma.passkey.create({
      data: {
        userId,
        credentialId,
        credentialPublicKey: Buffer.from('fake-public-key'),
        counter: 0,
        transports: ['internal'],
        deviceName,
      },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATION OPTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/passkey/register/options → 200 with WebAuthn options', async () => {
    const { accessToken } = await registerUser();

    const res = await request(app.getHttpServer())
      .post('/auth/passkey/register/options')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const options = res.body.data;
    expect(options).toMatchObject({
      challenge: expect.any(String),
      rp: {
        name: expect.any(String),
        id: expect.any(String),
      },
      user: {
        name: 'test@example.com',
      },
      timeout: 60000,
    });
    // pubKeyCredParams should be present
    expect(options.pubKeyCredParams).toBeDefined();
    expect(Array.isArray(options.pubKeyCredParams)).toBe(true);
  });

  it('POST /auth/passkey/register/options → 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/auth/passkey/register/options')
      .expect(401);
  });

  it('POST /auth/passkey/register/options → excludes existing passkeys', async () => {
    const { accessToken, userId } = await registerUser();

    // Create a passkey in DB
    const existingPasskey = await createPasskeyInDb(userId);

    const res = await request(app.getHttpServer())
      .post('/auth/passkey/register/options')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // The options should list the existing credential as excluded
    const options = res.body.data;
    expect(options.excludeCredentials).toBeDefined();
    expect(options.excludeCredentials.length).toBe(1);
    expect(options.excludeCredentials[0].id).toBe(existingPasskey.credentialId);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AUTHENTICATION OPTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('POST /auth/passkey/login/options → 200 with challenge (public)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/passkey/login/options')
      .expect(200);

    const options = res.body.data;
    expect(options).toMatchObject({
      challenge: expect.any(String),
      timeout: 60000,
      rpId: expect.any(String),
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIST PASSKEYS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /auth/passkey → 200 with empty list when no passkeys', async () => {
    const { accessToken } = await registerUser();

    const res = await request(app.getHttpServer())
      .get('/auth/passkey')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
  });

  it('GET /auth/passkey → 200 with passkeys list', async () => {
    const { accessToken, userId } = await registerUser();
    await createPasskeyInDb(userId, 'MacBook Touch ID');
    await createPasskeyInDb(userId, 'iPhone Face ID');

    const res = await request(app.getHttpServer())
      .get('/auth/passkey')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      deviceName: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('GET /auth/passkey → 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/auth/passkey')
      .expect(401);
  });

  it('GET /auth/passkey → only returns own passkeys', async () => {
    const user1 = await registerUser('user1@example.com');
    const user2 = await registerUser('user2@example.com');

    await createPasskeyInDb(user1.userId, 'User 1 key');
    await createPasskeyInDb(user2.userId, 'User 2 key');

    const res = await request(app.getHttpServer())
      .get('/auth/passkey')
      .set('Authorization', `Bearer ${user1.accessToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].deviceName).toBe('User 1 key');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENAME PASSKEY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('PATCH /auth/passkey/:id → 200 renames passkey', async () => {
    const { accessToken, userId } = await registerUser();
    const passkey = await createPasskeyInDb(userId, 'Old Name');

    const res = await request(app.getHttpServer())
      .patch(`/auth/passkey/${passkey.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ deviceName: 'New Name' })
      .expect(200);

    expect(res.body.data.deviceName).toBe('New Name');
  });

  it('PATCH /auth/passkey/:id → 404 for other user passkey', async () => {
    const user1 = await registerUser('user1@example.com');
    const user2 = await registerUser('user2@example.com');
    const passkey = await createPasskeyInDb(user2.userId);

    await request(app.getHttpServer())
      .patch(`/auth/passkey/${passkey.id}`)
      .set('Authorization', `Bearer ${user1.accessToken}`)
      .send({ deviceName: 'Hacked' })
      .expect(404);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE PASSKEY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('DELETE /auth/passkey/:id → 200 deletes passkey', async () => {
    const { accessToken, userId } = await registerUser();
    const passkey = await createPasskeyInDb(userId);

    await request(app.getHttpServer())
      .delete(`/auth/passkey/${passkey.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Verify it's gone
    const remaining = await prisma.passkey.findMany({ where: { userId } });
    expect(remaining).toHaveLength(0);
  });

  it('DELETE /auth/passkey/:id → 404 for other user passkey', async () => {
    const user1 = await registerUser('user1@example.com');
    const user2 = await registerUser('user2@example.com');
    const passkey = await createPasskeyInDb(user2.userId);

    await request(app.getHttpServer())
      .delete(`/auth/passkey/${passkey.id}`)
      .set('Authorization', `Bearer ${user1.accessToken}`)
      .expect(404);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // hasPasskey FLAG
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('GET /auth/me → hasPasskey is false when no passkeys', async () => {
    const { accessToken } = await registerUser();

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.hasPasskey).toBe(false);
  });

  it('GET /auth/me → hasPasskey is true when passkey exists', async () => {
    const { accessToken, userId } = await registerUser();
    await createPasskeyInDb(userId);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.hasPasskey).toBe(true);
  });
});
