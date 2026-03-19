/**
 * Local File Store
 *
 * Writes uploaded files to the local filesystem.
 * Suitable for development and single-instance deployments.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { FileStore, ParsedFile, SignedUrlOptions, StoredFile } from '../types';

export interface LocalFileStoreOptions {
  /** Root directory for stored files. Default: './uploads' */
  directory?: string | undefined;
  /** Base URL used when generating signed URLs. Default: 'http://localhost:3000/files' */
  baseUrl?: string | undefined;
}

export class LocalFileStore implements FileStore {
  private readonly directory: string;
  private readonly baseUrl: string;

  constructor(options?: LocalFileStoreOptions) {
    this.directory = options?.directory ?? './uploads';
    this.baseUrl = options?.baseUrl ?? 'http://localhost:3000/files';
  }

  async upload(file: ParsedFile): Promise<StoredFile> {
    await mkdir(this.directory, { recursive: true });

    const ext = extname(file.name);
    const key = `${randomUUID()}${ext}`;
    const filePath = join(this.directory, key);

    await writeFile(filePath, file.buffer);

    return {
      key,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  async download(key: string): Promise<Buffer | undefined> {
    try {
      return await readFile(join(this.directory, key));
    } catch {
      return undefined;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(join(this.directory, key));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    const expires = Date.now() + expiresIn * 1000;
    return `${this.baseUrl}/${key}?expires=${expires}`;
  }
}
