/**
 * # In-Memory Token Store
 *
 * Stores email verification and password reset tokens in a Map.
 * Suitable for single-server deployments and development.
 *
 * ⚠️  Does NOT survive server restarts.
 * ⚠️  Does NOT work across multiple server instances.
 *
 * When Redis is enabled, RedisTokenStore replaces this automatically.
 */
import { Injectable } from '@nestjs/common';
import type { TokenStore, StoredToken } from './token-store.interface';

@Injectable()
export class MemoryTokenStore implements TokenStore {
  private readonly store = new Map<string, StoredToken>();

  async set(hash: string, data: StoredToken, _ttlMs: number): Promise<void> {
    // TTL is embedded in `data.expiresAt` — checked at read time.
    // The `_ttlMs` param exists for Redis (which uses native TTL).
    this.store.set(hash, data);
  }

  async get(hash: string): Promise<StoredToken | undefined> {
    const stored = this.store.get(hash);
    if (!stored) return undefined;

    // Check expiry
    if (stored.expiresAt < new Date()) {
      this.store.delete(hash);
      return undefined;
    }

    return stored;
  }

  async delete(hash: string): Promise<void> {
    this.store.delete(hash);
  }
}
