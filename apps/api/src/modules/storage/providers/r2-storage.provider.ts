/**
 * # R2 Storage Provider
 *
 * Uploads files to Cloudflare R2 (S3-compatible object storage).
 *
 * ## Why Cloudflare R2?
 *
 * - **S3-compatible**: Uses the standard AWS S3 SDK (same API, different endpoint)
 * - **Zero egress fees**: You don't pay when users download files (AWS S3 charges for this)
 * - **Global CDN**: Files are served from Cloudflare's edge network
 * - **Cheap**: $0.015/GB/month storage, free egress
 *
 * ## How it works
 *
 * 1. Creates an S3 client pointed at Cloudflare's endpoint
 * 2. Generates a unique key like "avatars/uuid.jpg"
 * 3. Uses PutObjectCommand to upload the file
 * 4. Returns the public URL (R2_PUBLIC_URL + key)
 *
 * ## R2 Public URL
 *
 * R2 buckets can be:
 * - **Private**: Accessed via signed URLs (time-limited, for sensitive files)
 * - **Public**: Accessed via a custom domain (e.g. cdn.yourapp.com)
 *
 * For avatars, we use public access. You set this up in the Cloudflare dashboard
 * by enabling "Public access" on the bucket and optionally adding a custom domain.
 * The `R2_PUBLIC_URL` env var should be something like `https://cdn.yourapp.com`.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from './storage-provider.interface';

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly s3: S3Client;

  constructor(
    private readonly bucketName: string,
    private readonly publicUrl: string,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    /**
     * The S3 client is configured to talk to Cloudflare R2 instead of AWS.
     * The key difference is the `endpoint` — it points to Cloudflare's S3-compatible API.
     *
     * Format: https://<account-id>.r2.cloudflarestorage.com
     */
    this.s3 = new S3Client({
      region: 'auto', // R2 doesn't use regions, but the SDK requires one
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { buffer, filename, mimeType, folder } = options;

    // Generate unique key: "avatars/uuid.jpg"
    const ext = extname(filename).toLowerCase() || '.bin';
    const key = `${folder}/${randomUUID()}${ext}`;

    // Upload to R2 using the S3 PutObject API
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // CacheControl: files rarely change once uploaded
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    // Build the public URL
    // e.g. https://cdn.yourapp.com/avatars/uuid.jpg
    const url = `${this.publicUrl.replace(/\/$/, '')}/${key}`;

    this.logger.log(`File uploaded to R2: ${key} (${buffer.length} bytes)`);

    return { url, key };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`File deleted from R2: ${key}`);
    } catch (error) {
      // S3 DeleteObject is idempotent — it doesn't error on missing keys.
      // But we catch anyway in case of network/permission issues.
      this.logger.warn(`Failed to delete from R2: ${key}`, error);
    }
  }
}
