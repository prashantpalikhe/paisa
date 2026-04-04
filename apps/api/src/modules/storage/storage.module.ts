/**
 * # Storage Module
 *
 * Optional module — loaded ONLY when `FEATURE_STORAGE_ENABLED=true`.
 * Follows the same pattern as EmailModule:
 *
 * | STORAGE_PROVIDER | Implementation       | Use case         |
 * |------------------|----------------------|------------------|
 * | local            | LocalStorageProvider  | Development      |
 * | r2               | R2StorageProvider     | Production       |
 *
 * ## How provider selection works
 *
 * The `register()` factory reads the config to decide which provider to create:
 *
 * ```
 * STORAGE_PROVIDER=local  → LocalStorageProvider  (saves to disk)
 * STORAGE_PROVIDER=r2     → R2StorageProvider     (uploads to Cloudflare R2)
 * ```
 *
 * ## Registration in AppModule
 *
 * ```typescript
 * const optionalModules = [
 *   features.storage.enabled && StorageModule.register(),
 * ].filter(Boolean);
 * ```
 */
import { DynamicModule, Module } from '@nestjs/common';
import { AppConfigService } from '../../core/config/config.service';
import { STORAGE_PROVIDER } from './providers/storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { R2StorageProvider } from './providers/r2-storage.provider';

@Module({})
export class StorageModule {
  static register(): DynamicModule {
    return {
      module: StorageModule,
      global: true, // Make STORAGE_PROVIDER available to all modules
      providers: [
        {
          provide: STORAGE_PROVIDER,
          useFactory: (config: AppConfigService) => {
            const storageConfig = config.features.storage;

            if (storageConfig.provider === 'r2') {
              // Production: Cloudflare R2
              return new R2StorageProvider(
                storageConfig.r2BucketName!,
                storageConfig.r2PublicUrl!,
                storageConfig.r2AccountId!,
                storageConfig.r2AccessKeyId!,
                storageConfig.r2SecretAccessKey!,
              );
            }

            // Default: Local filesystem (development)
            return new LocalStorageProvider();
          },
          inject: [AppConfigService],
        },
      ],
      exports: [STORAGE_PROVIDER],
    };
  }
}
