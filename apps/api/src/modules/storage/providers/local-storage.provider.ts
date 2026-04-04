/**
 * # Local Storage Provider
 *
 * Saves files to the local filesystem. Used in development so you
 * don't need a Cloudflare R2 account to work on file uploads.
 *
 * Files are stored in `apps/api/uploads/` which is:
 * - Gitignored (you don't want uploads in your repo)
 * - Served statically by NestJS (so URLs like /uploads/avatars/abc.jpg work)
 *
 * ## How it works
 *
 * 1. Receives a file buffer + metadata
 * 2. Creates the folder if it doesn't exist (e.g. `uploads/avatars/`)
 * 3. Generates a unique filename (UUID + original extension)
 * 4. Writes the file to disk
 * 5. Returns a URL path like `/uploads/avatars/uuid.jpg`
 *
 * ## Why UUID filenames?
 *
 * - Prevents filename collisions (two users upload "photo.jpg")
 * - Prevents path traversal attacks (malicious filenames like "../../etc/passwd")
 * - Makes URLs non-guessable (privacy)
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { join, extname } from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from './storage-provider.interface';

/** Base directory for local uploads (relative to API working directory) */
const UPLOADS_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);

  async upload(options: UploadOptions): Promise<UploadResult> {
    const { buffer, filename, folder } = options;

    // 1. Build a safe, unique filename
    //    extname(".photo.jpg") → ".jpg", extname("noext") → ""
    const ext = extname(filename).toLowerCase() || '.bin';
    const uniqueName = `${randomUUID()}${ext}`;

    // 2. Ensure the folder exists (e.g. uploads/avatars/)
    const folderPath = join(UPLOADS_DIR, folder);
    await mkdir(folderPath, { recursive: true });

    // 3. Write the file
    const filePath = join(folderPath, uniqueName);
    await writeFile(filePath, buffer);

    // 4. Build the key and URL
    //    key: "avatars/uuid.jpg" (used for deletion)
    //    url: "/uploads/avatars/uuid.jpg" (served by NestJS static files)
    const key = `${folder}/${uniqueName}`;
    const url = `/uploads/${key}`;

    this.logger.log(`File uploaded locally: ${key} (${buffer.length} bytes)`);

    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const filePath = join(UPLOADS_DIR, key);

    try {
      await unlink(filePath);
      this.logger.log(`File deleted locally: ${key}`);
    } catch (error: any) {
      // ENOENT = file doesn't exist — that's fine (idempotent delete)
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
