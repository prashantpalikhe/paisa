/**
 * # Storage Provider Interface
 *
 * Defines the contract that ALL storage providers must implement.
 * This is the "Strategy Pattern" — we code against this interface,
 * and swap implementations based on environment/config.
 *
 * ## Why an interface + injection token?
 *
 * NestJS can't inject TypeScript interfaces directly (they're erased
 * at runtime). So we create a "token" — a constant string that acts
 * as a key in the dependency injection container.
 *
 * ```typescript
 * // In the module:
 * { provide: STORAGE_PROVIDER, useClass: LocalStorageProvider }
 *
 * // In a service:
 * @Inject(STORAGE_PROVIDER) private storage: StorageProvider
 * ```
 */

/** Injection token — used instead of a class name for DI */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

/** Metadata about an uploaded file */
export interface UploadResult {
  /** Public URL where the file can be accessed */
  url: string;
  /** Storage key (path/filename) — needed for deletion */
  key: string;
}

/** Options for uploading a file */
export interface UploadOptions {
  /** The file buffer (raw bytes) */
  buffer: Buffer;
  /** Original filename (e.g. "photo.jpg") */
  filename: string;
  /** MIME type (e.g. "image/jpeg") */
  mimeType: string;
  /** Storage folder/prefix (e.g. "avatars") */
  folder: string;
}

/** The contract every storage provider must implement */
export interface StorageProvider {
  /**
   * Upload a file and return its public URL + storage key.
   */
  upload(options: UploadOptions): Promise<UploadResult>;

  /**
   * Delete a file by its storage key.
   * Should not throw if the file doesn't exist (idempotent).
   */
  delete(key: string): Promise<void>;
}
