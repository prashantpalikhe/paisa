/**
 * # In-Memory Challenge Store
 *
 * Stores WebAuthn challenges in a Map with periodic cleanup and size cap.
 * Suitable for single-server deployments and development.
 *
 * ## Memory protection
 *
 * - MAX_CHALLENGES cap (10,000) prevents memory exhaustion from abuse
 * - Periodic cleanup every 60 seconds evicts expired entries
 * - When cap is hit, oldest 100 entries are evicted (FIFO)
 *
 * ⚠️  Does NOT survive server restarts.
 * ⚠️  Does NOT work across multiple server instances.
 *
 * When Redis is enabled, RedisChallengeStore replaces this automatically.
 */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import type { ChallengeStore, StoredChallenge } from './challenge-store.interface';

const MAX_CHALLENGES = 10_000;

@Injectable()
export class MemoryChallengeStore
  implements ChallengeStore, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MemoryChallengeStore.name);
  private readonly store = new Map<string, StoredChallenge>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  onModuleInit() {
    // Sweep expired challenges every 60 seconds
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      for (const [key, stored] of this.store) {
        if (stored.expiresAt < now) this.store.delete(key);
      }
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }

  async set(key: string, challenge: string, ttlMs: number): Promise<void> {
    // Prevent memory exhaustion from abuse of public endpoints
    if (this.store.size >= MAX_CHALLENGES) {
      const iterator = this.store.keys();
      for (let i = 0; i < 100; i++) {
        const oldest = iterator.next();
        if (oldest.done) break;
        this.store.delete(oldest.value);
      }
      this.logger.warn(
        `Challenge store hit cap (${MAX_CHALLENGES}), evicted 100 oldest entries`,
      );
    }

    this.store.set(key, {
      challenge,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  }

  async get(key: string): Promise<string | undefined> {
    const stored = this.store.get(key);
    if (!stored) return undefined;

    if (stored.expiresAt < new Date()) {
      this.store.delete(key);
      return undefined;
    }

    return stored.challenge;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
