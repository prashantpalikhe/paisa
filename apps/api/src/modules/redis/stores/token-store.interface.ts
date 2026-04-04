/**
 * # Token Store Interface
 *
 * Abstraction for storing short-lived tokens (email verification, password reset).
 * Two implementations:
 * - MemoryTokenStore: In-memory Map (single server, development)
 * - RedisTokenStore: Redis-backed with automatic TTL (multi-server, production)
 */

export interface StoredToken {
  userId: string;
  type: 'email_verification' | 'password_reset';
  expiresAt: Date;
}

export interface TokenStore {
  /** Store a token with a TTL. Key is the SHA-256 hash. */
  set(hash: string, data: StoredToken, ttlMs: number): Promise<void>;

  /** Get a token by hash. Returns undefined if not found or expired. */
  get(hash: string): Promise<StoredToken | undefined>;

  /** Delete a token by hash. */
  delete(hash: string): Promise<void>;
}
