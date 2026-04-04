/**
 * # Passkey Service
 *
 * Handles WebAuthn registration and authentication ceremonies.
 *
 * ## Two ceremonies
 *
 * 1. **Registration** (adding a passkey to an existing account):
 *    - generateRegistrationOptions() → challenge + config sent to browser
 *    - verifyRegistration() → browser response verified, public key stored in DB
 *
 * 2. **Authentication** (logging in with a passkey):
 *    - generateAuthenticationOptions() → challenge + allowed credentials sent to browser
 *    - verifyAuthentication() → browser signature verified against stored public key
 *
 * ## Challenge store
 *
 * Challenges are short-lived (60 seconds) and stored in memory.
 * They're single-use: consumed on verification.
 * TODO: Replace with Redis in Phase 8 for multi-server deployments.
 *
 * ## Key concepts
 *
 * - **RP (Relying Party)**: Your app — identified by rpId (domain) and rpName
 * - **Credential ID**: Unique identifier for a passkey, stored as base64url
 * - **Public key**: Stored as raw bytes in DB, used to verify signatures
 * - **Counter**: Incremented by the authenticator on each use (clone detection)
 * - **Transports**: How the authenticator communicates (usb, ble, nfc, internal)
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { DatabaseService } from '../../core/database/database.service';
import { AppConfigService } from '../../core/config/config.service';

/**
 * In-memory challenge store.
 * Key: identifier (userId for registration, random for authentication)
 * Value: { challenge, expiresAt }
 *
 * Challenges expire after 60 seconds (WebAuthn best practice).
 */
interface StoredChallenge {
  challenge: string;
  expiresAt: Date;
}

@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);

  /** In-memory challenge store. Replaced by Redis in Phase 8. */
  private readonly challengeStore = new Map<string, StoredChallenge>();

  /** WebAuthn Relying Party config — read from env vars */
  private readonly rpName: string;
  private readonly rpId: string;
  private readonly origin: string;

  constructor(
    private readonly db: DatabaseService,
    config: AppConfigService,
  ) {
    this.rpName = config.env.WEBAUTHN_RP_NAME;
    this.rpId = config.env.WEBAUTHN_RP_ID;
    this.origin = config.env.WEBAUTHN_ORIGIN;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REGISTRATION (adding a passkey to an account)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Step 1 of registration: generate options for the browser.
   *
   * Tells the browser/OS:
   * - Who is the relying party (your app)
   * - Who is the user (so the authenticator doesn't create duplicates)
   * - Which credentials already exist (to prevent re-registration)
   * - What type of authenticator is acceptable
   *
   * The returned options are passed to `navigator.credentials.create()` on the frontend.
   */
  async generateRegistrationOptions(userId: string, userEmail: string) {
    // Fetch existing passkeys so the browser can exclude them
    // (prevents registering the same authenticator twice)
    const existingPasskeys = await this.db.passkey.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      // userID must be opaque — don't use email (privacy). Use a random buffer.
      // We use the existing Prisma ID encoded as bytes.
      userName: userEmail,
      // Prevent re-registering the same authenticator
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports as AuthenticatorTransportFuture[],
      })),
      // Prefer platform authenticators (Touch ID, Face ID, Windows Hello)
      // but allow cross-platform (USB keys, phones) too
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      // Challenge timeout: 60 seconds
      timeout: 60_000,
    });

    // Store the challenge for verification (Step 2)
    this.storeChallenge(`reg:${userId}`, options.challenge);

    return options;
  }

  /**
   * Step 2 of registration: verify the browser's response.
   *
   * The browser created a new keypair and signed the challenge.
   * We verify the signature, then store the public key in the DB.
   *
   * @param userId - The authenticated user's ID
   * @param response - The response from navigator.credentials.create()
   * @param deviceName - Optional friendly name (e.g., "MacBook Touch ID")
   */
  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    deviceName?: string,
  ) {
    // Retrieve and consume the stored challenge
    const expectedChallenge = this.consumeChallenge(`reg:${userId}`);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Store the passkey in the database
    const passkey = await this.db.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceName: deviceName || this.inferDeviceName(credentialDeviceType, credentialBackedUp),
      },
    });

    this.logger.log(
      `Passkey registered for user ${userId}: ${passkey.id} (${credentialDeviceType}, backed up: ${credentialBackedUp})`,
    );

    return {
      id: passkey.id,
      credentialId: passkey.credentialId,
      deviceName: passkey.deviceName,
      createdAt: passkey.createdAt,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AUTHENTICATION (logging in with a passkey)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Step 1 of authentication: generate options for the browser.
   *
   * For discoverable credentials (passkeys), we don't need to know the
   * user's email upfront — the authenticator holds the credential and
   * the userHandle tells us who they are.
   *
   * The returned options are passed to `navigator.credentials.get()` on the frontend.
   */
  async generateAuthenticationOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      timeout: 60_000,
    });

    // Store challenge keyed by the challenge itself (we don't know the user yet)
    this.storeChallenge(`auth:${options.challenge}`, options.challenge);

    return options;
  }

  /**
   * Step 2 of authentication: verify the browser's signature.
   *
   * The authenticator signed the challenge with the private key.
   * We look up the credential in our DB and verify using the stored public key.
   *
   * The `challengeKey` is the original challenge string returned in Step 1.
   * The frontend must send it back so we can look up the stored challenge.
   * This is NOT a security risk — the challenge is a random nonce, not a secret.
   * The actual security comes from the authenticator's private key signature.
   *
   * @returns The authenticated user from the database
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    challengeKey: string,
  ) {
    // Find the passkey by credential ID
    const passkey = await this.db.passkey.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });

    if (!passkey) {
      throw new UnauthorizedException('Passkey not recognized');
    }

    // Check if the user is banned
    if (passkey.user.banned) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    // Consume the stored challenge
    const expectedChallenge = this.consumeChallenge(`auth:${challengeKey}`);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.credentialPublicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    // Update the counter (clone detection: if counter goes backwards, something is wrong)
    await this.db.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    return passkey.user;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MANAGEMENT (list, rename, delete passkeys)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** List all passkeys for a user */
  async listPasskeys(userId: string) {
    return this.db.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        credentialId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Check if a user has any passkeys */
  async hasPasskey(userId: string): Promise<boolean> {
    const count = await this.db.passkey.count({
      where: { userId },
    });
    return count > 0;
  }

  /** Rename a passkey */
  async renamePasskey(userId: string, passkeyId: string, deviceName: string) {
    const passkey = await this.db.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) {
      throw new NotFoundException('Passkey not found');
    }

    return this.db.passkey.update({
      where: { id: passkeyId },
      data: { deviceName },
      select: { id: true, deviceName: true, createdAt: true },
    });
  }

  /** Delete a passkey */
  async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await this.db.passkey.findFirst({
      where: { id: passkeyId, userId },
    });

    if (!passkey) {
      throw new NotFoundException('Passkey not found');
    }

    await this.db.passkey.delete({ where: { id: passkeyId } });

    this.logger.log(`Passkey deleted for user ${userId}: ${passkeyId}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRIVATE: Challenge store
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private storeChallenge(key: string, challenge: string): void {
    this.challengeStore.set(key, {
      challenge,
      expiresAt: new Date(Date.now() + 60_000), // 60 seconds
    });
  }

  private consumeChallenge(key: string): string {
    const stored = this.challengeStore.get(key);

    if (!stored) {
      throw new UnauthorizedException(
        'Challenge not found or expired. Please start the process again.',
      );
    }

    if (stored.expiresAt < new Date()) {
      this.challengeStore.delete(key);
      throw new UnauthorizedException(
        'Challenge expired. Please start the process again.',
      );
    }

    // Single-use: delete after consumption
    this.challengeStore.delete(key);

    return stored.challenge;
  }

  /** Generate a human-friendly device name from credential metadata */
  private inferDeviceName(
    deviceType: string,
    backedUp: boolean,
  ): string {
    if (deviceType === 'singleDevice') {
      return backedUp ? 'Security key (backed up)' : 'Security key';
    }
    return backedUp ? 'Synced passkey' : 'Device passkey';
  }
}
