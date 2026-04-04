/**
 * # Redis Challenge Store
 *
 * Stores WebAuthn challenges in Redis with automatic TTL.
 * Used when `FEATURE_REDIS_ENABLED=true` for multi-server deployments.
 *
 * ## Key format
 *
 * `challenge:{key}` → challenge string
 *
 * Redis handles expiry natively via `PX` (millisecond TTL),
 * so no cleanup interval or size cap is needed — Redis manages memory.
 */
import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { ChallengeStore } from './challenge-store.interface';

const KEY_PREFIX = 'challenge:';

@Injectable()
export class RedisChallengeStore implements ChallengeStore {
  constructor(private readonly redis: Redis) {}

  async set(key: string, challenge: string, ttlMs: number): Promise<void> {
    await this.redis.set(`${KEY_PREFIX}${key}`, challenge, 'PX', ttlMs);
  }

  async get(key: string): Promise<string | undefined> {
    const result = await this.redis.get(`${KEY_PREFIX}${key}`);
    return result ?? undefined;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${key}`);
  }
}
