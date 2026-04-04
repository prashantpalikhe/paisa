/**
 * # Redis Token Store
 *
 * Stores email verification and password reset tokens in Redis with automatic TTL.
 * Used when `FEATURE_REDIS_ENABLED=true` for multi-server deployments.
 *
 * ## Key format
 *
 * `token:{hash}` → JSON string of StoredToken
 *
 * Redis handles expiry natively via `PX` (millisecond TTL),
 * so no cleanup interval is needed.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { TokenStore, StoredToken } from './token-store.interface';

const KEY_PREFIX = 'token:';

@Injectable()
export class RedisTokenStore implements TokenStore {
  private readonly logger = new Logger(RedisTokenStore.name);

  constructor(private readonly redis: Redis) {}

  async set(hash: string, data: StoredToken, ttlMs: number): Promise<void> {
    const key = `${KEY_PREFIX}${hash}`;
    const value = JSON.stringify({
      userId: data.userId,
      type: data.type,
      expiresAt: data.expiresAt.toISOString(),
    });

    await this.redis.set(key, value, 'PX', ttlMs);
  }

  async get(hash: string): Promise<StoredToken | undefined> {
    const key = `${KEY_PREFIX}${hash}`;
    const raw = await this.redis.get(key);

    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw);
      return {
        userId: parsed.userId,
        type: parsed.type,
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch (err) {
      this.logger.warn(`Failed to parse token from Redis: ${key}`, err);
      // Corrupt entry — delete it
      await this.redis.del(key);
      return undefined;
    }
  }

  async delete(hash: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${hash}`);
  }
}
