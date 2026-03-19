/**
 * S3 File Store (Interface + Stub)
 *
 * Defines the contract for an AWS S3-backed file store suitable for
 * production deployments. Provides a mock implementation backed by
 * in-memory Maps for testing.
 */

import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { FileStore, ParsedFile, SignedUrlOptions, StoredFile } from '../types';

/**
 * Minimal S3 client interface.
 * Any S3-compatible library exposing these methods can be used.
 */
export interface S3Client {
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer;
    ContentType: string;
  }): Promise<void>;

  getObject(params: { Bucket: string; Key: string }): Promise<{ Body: Buffer } | undefined>;

  deleteObject(params: { Bucket: string; Key: string }): Promise<void>;

  getSignedUrl(params: { Bucket: string; Key: string; Expires: number }): Promise<string>;
}

export interface S3FileStoreOptions {
  /** S3 client instance */
  client: S3Client;
  /** S3 bucket name */
  bucket: string;
  /** Optional key prefix (e.g. "uploads/") */
  keyPrefix?: string | undefined;
}

export class S3FileStore implements FileStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(options: S3FileStoreOptions) {
    this.client = options.client;
    this.bucket = options.bucket;
    this.keyPrefix = options.keyPrefix ?? '';
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async upload(file: ParsedFile): Promise<StoredFile> {
    const ext = extname(file.name);
    const key = `${randomUUID()}${ext}`;

    await this.client.putObject({
      Bucket: this.bucket,
      Key: this.fullKey(key),
      Body: file.buffer,
      ContentType: file.type,
    });

    return {
      key,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  async download(key: string): Promise<Buffer | undefined> {
    const result = await this.client.getObject({
      Bucket: this.bucket,
      Key: this.fullKey(key),
    });
    return result?.Body;
  }

  async delete(key: string): Promise<void> {
    await this.client.deleteObject({
      Bucket: this.bucket,
      Key: this.fullKey(key),
    });
  }

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    return this.client.getSignedUrl({
      Bucket: this.bucket,
      Key: this.fullKey(key),
      Expires: expiresIn,
    });
  }

  /**
   * Create a mock S3 file store backed by in-memory Maps.
   * Useful for testing without a real S3 connection.
   */
  static createMock(bucket = 'test-bucket'): S3FileStore {
    const data = new Map<string, { Body: Buffer; ContentType: string }>();

    const mockClient: S3Client = {
      async putObject(params) {
        data.set(`${params.Bucket}/${params.Key}`, {
          Body: params.Body,
          ContentType: params.ContentType,
        });
      },
      async getObject(params) {
        const entry = data.get(`${params.Bucket}/${params.Key}`);
        if (!entry) return undefined;
        return { Body: entry.Body };
      },
      async deleteObject(params) {
        data.delete(`${params.Bucket}/${params.Key}`);
      },
      async getSignedUrl(params) {
        return `https://${params.Bucket}.s3.amazonaws.com/${params.Key}?X-Amz-Expires=${params.Expires}`;
      },
    };

    return new S3FileStore({ client: mockClient, bucket });
  }
}
