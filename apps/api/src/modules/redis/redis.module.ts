/**
 * # Redis Module
 *
 * Always-loaded module that provides Redis-backed (or in-memory) stores for:
 * - **Token Store**: Email verification and password reset tokens
 * - **Challenge Store**: WebAuthn challenges
 *
 * ## How provider selection works
 *
 * ```
 * FEATURE_REDIS_ENABLED=false (default)
 *   → REDIS_CLIENT = null
 *   → TOKEN_STORE = MemoryTokenStore (same as before Redis module existed)
 *   → CHALLENGE_STORE = MemoryChallengeStore (same as before)
 *
 * FEATURE_REDIS_ENABLED=true
 *   → REDIS_CLIENT = ioredis client connected to REDIS_URL
 *   → TOKEN_STORE = RedisTokenStore (automatic TTL, survives restarts)
 *   → CHALLENGE_STORE = RedisChallengeStore (automatic TTL, multi-server)
 * ```
 *
 * ## Architectural invariant
 *
 * This module is always loaded (like StorageModule and EmailModule).
 * It does NOT appear in `optionalModules` — it's in the always-loaded section.
 * The feature flag controls WHICH implementation is used, not WHETHER
 * the module loads. This means auth flows work identically regardless of
 * whether Redis is enabled.
 */
import { DynamicModule, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../core/config/config.service';
import { REDIS_CLIENT, TOKEN_STORE, CHALLENGE_STORE } from './redis.constants';
import { MemoryTokenStore } from './stores/memory-token-store';
import { RedisTokenStore } from './stores/redis-token-store';
import { MemoryChallengeStore } from './stores/memory-challenge-store';
import { RedisChallengeStore } from './stores/redis-challenge-store';

@Module({})
export class RedisModule {
  private static readonly logger = new Logger(RedisModule.name);

  static register(): DynamicModule {
    return {
      module: RedisModule,
      global: true, // TOKEN_STORE and CHALLENGE_STORE injectable everywhere
      providers: [
        // ─── Redis Client (null when disabled) ───
        {
          provide: REDIS_CLIENT,
          useFactory: (config: AppConfigService) => {
            if (!config.features.redis.enabled) {
              this.logger.log('Redis disabled — using in-memory stores');
              return null;
            }

            const url = config.features.redis.url!;
            this.logger.log('Connecting to Redis...');

            const client = new Redis(url, {
              maxRetriesPerRequest: 3,
              retryStrategy: (times) => {
                if (times > 10) {
                  this.logger.error(
                    'Redis connection failed after 10 retries — giving up',
                  );
                  return null; // Stop retrying
                }
                return Math.min(times * 200, 5000); // Exponential backoff, max 5s
              },
              lazyConnect: false,
            });

            client.on('connect', () => this.logger.log('Redis connected'));
            client.on('error', (err) =>
              this.logger.error('Redis error:', err.message),
            );

            return client;
          },
          inject: [AppConfigService],
        },

        // ─── Token Store (email verification + password reset) ───
        {
          provide: TOKEN_STORE,
          useFactory: (config: AppConfigService, redis: Redis | null) => {
            if (config.features.redis.enabled && redis) {
              return new RedisTokenStore(redis);
            }
            return new MemoryTokenStore();
          },
          inject: [AppConfigService, REDIS_CLIENT],
        },

        // ─── Challenge Store (WebAuthn) ───
        // Note: MemoryChallengeStore implements OnModuleInit/OnModuleDestroy
        // for the cleanup interval, but NestJS only calls lifecycle hooks on
        // providers that are instantiated by the DI container (not via useFactory).
        // So we register MemoryChallengeStore as a class provider when it's the
        // active implementation.
        MemoryChallengeStore,
        {
          provide: CHALLENGE_STORE,
          useFactory: (
            config: AppConfigService,
            redis: Redis | null,
            memoryChallengeStore: MemoryChallengeStore,
          ) => {
            if (config.features.redis.enabled && redis) {
              return new RedisChallengeStore(redis);
            }
            return memoryChallengeStore;
          },
          inject: [AppConfigService, REDIS_CLIENT, MemoryChallengeStore],
        },
      ],
      exports: [REDIS_CLIENT, TOKEN_STORE, CHALLENGE_STORE],
    };
  }
}
