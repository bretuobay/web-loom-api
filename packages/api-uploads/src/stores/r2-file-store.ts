/**
 * Cloudflare R2 File Store (Interface + Stub)
 *
 * Defines the contract for a Cloudflare R2-backed file store.
 * R2 is S3-compatible but uses Cloudflare's network for low-latency
 * access at the edge. Provides a mock implementation for testing.
 */

import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { FileStore, ParsedFile, SignedUrlOptions, StoredFile } from '../types';

/**
 * Minimal R2 client interface.
 * Mirrors the Cloudflare Workers R2 bucket API.
 */
export interface R2Client {
  put(key: string, value: Buffer, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
}

export interface R2FileStoreOptions {
  /** R2 client / bucket binding */
  client: R2Client;
  /** Public URL base for the R2 bucket (used for signed URLs) */
  publicUrl?: string | undefined;
  /** Optional key prefix */
  keyPrefix?: string | undefined;
}

export class R2FileStore implements FileStore {
  private readonly client: R2Client;
  private readonly publicUrl: string;
  private readonly keyPrefix: string;

  constructor(options: R2FileStoreOptions) {
    this.client = options.client;
    this.publicUrl = options.publicUrl ?? 'https://r2.example.com';
    this.keyPrefix = options.keyPrefix ?? '';
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async upload(file: ParsedFile): Promise<StoredFile> {
    const ext = extname(file.name);
    const key = `${randomUUID()}${ext}`;

    await this.client.put(this.fullKey(key), file.buffer, {
      httpMetadata: { contentType: file.type },
    });

    return {
      key,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  async download(key: string): Promise<Buffer | undefined> {
    const obj = await this.client.get(this.fullKey(key));
    if (!obj) return undefined;
    const ab = await obj.arrayBuffer();
    return Buffer.from(ab);
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(this.fullKey(key));
  }

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    const expires = Date.now() + expiresIn * 1000;
    return `${this.publicUrl}/${this.fullKey(key)}?expires=${expires}&sig=mock`;
  }

  /**
   * Create a mock R2 file store backed by in-memory Maps.
   * Useful for testing without a real Cloudflare R2 binding.
   */
  static createMock(): R2FileStore {
    const data = new Map<string, { buffer: Buffer; contentType: string }>();

    const mockClient: R2Client = {
      async put(key, value, options) {
        data.set(key, {
          buffer: Buffer.from(value),
          contentType: options?.httpMetadata?.contentType ?? 'application/octet-stream',
        });
      },
      async get(key) {
        const entry = data.get(key);
        if (!entry) return null;
        const buf = entry.buffer;
        return {
          arrayBuffer() {
            return Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
          },
        };
      },
      async delete(key) {
        data.delete(key);
      },
    };

    return new R2FileStore({ client: mockClient });
  }
}
