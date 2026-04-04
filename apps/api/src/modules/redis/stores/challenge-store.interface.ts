/**
 * # Challenge Store Interface
 *
 * Abstraction for storing WebAuthn challenges (registration + authentication).
 * Two implementations:
 * - MemoryChallengeStore: In-memory Map with periodic cleanup (single server, development)
 * - RedisChallengeStore: Redis-backed with automatic TTL (multi-server, production)
 */

export interface StoredChallenge {
  challenge: string;
  expiresAt: Date;
}

export interface ChallengeStore {
  /** Store a challenge with a TTL. Key is the challenge identifier. */
  set(key: string, challenge: string, ttlMs: number): Promise<void>;

  /** Get a challenge by key. Returns undefined if not found or expired. */
  get(key: string): Promise<string | undefined>;

  /** Delete a challenge by key (single-use consumption). */
  delete(key: string): Promise<void>;
}
