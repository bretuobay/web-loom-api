import { describe, expect, it } from 'vitest';
import type { ParsedFile } from '../types';
import { S3FileStore } from '../stores/s3-file-store';
import { R2FileStore } from '../stores/r2-file-store';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function makeParsedFile(overrides?: Partial<ParsedFile>): ParsedFile {
  return {
    name: 'test.txt',
    size: 11,
    type: 'text/plain',
    buffer: Buffer.from('hello world'),
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// S3FileStore (mock)
// -----------------------------------------------------------------------

describe('S3FileStore (mock)', () => {
  it('uploads and downloads a file', async () => {
    const store = S3FileStore.createMock();
    const file = makeParsedFile();

    const stored = await store.upload(file);
    expect(stored.name).toBe('test.txt');
    expect(stored.size).toBe(11);
    expect(stored.type).toBe('text/plain');
    expect(stored.key).toBeTruthy();

    const downloaded = await store.download(stored.key);
    expect(downloaded?.toString()).toBe('hello world');
  });

  it('returns undefined for missing file', async () => {
    const store = S3FileStore.createMock();
    const result = await store.download('nonexistent');
    expect(result).toBeUndefined();
  });

  it('deletes a file', async () => {
    const store = S3FileStore.createMock();
    const stored = await store.upload(makeParsedFile());

    await store.delete(stored.key);
    const result = await store.download(stored.key);
    expect(result).toBeUndefined();
  });

  it('generates a signed URL', async () => {
    const store = S3FileStore.createMock();
    const stored = await store.upload(makeParsedFile());

    const url = await store.getSignedUrl(stored.key, { expiresIn: 600 });
    expect(url).toContain('s3.amazonaws.com');
    expect(url).toContain('X-Amz-Expires=600');
  });
});

// -----------------------------------------------------------------------
// R2FileStore (mock)
// -----------------------------------------------------------------------

describe('R2FileStore (mock)', () => {
  it('uploads and downloads a file', async () => {
    const store = R2FileStore.createMock();
    const file = makeParsedFile({ name: 'image.png', type: 'image/png' });

    const stored = await store.upload(file);
    expect(stored.name).toBe('image.png');
    expect(stored.type).toBe('image/png');

    const downloaded = await store.download(stored.key);
    expect(downloaded?.toString()).toBe('hello world');
  });

  it('returns undefined for missing file', async () => {
    const store = R2FileStore.createMock();
    const result = await store.download('nonexistent');
    expect(result).toBeUndefined();
  });

  it('deletes a file', async () => {
    const store = R2FileStore.createMock();
    const stored = await store.upload(makeParsedFile());

    await store.delete(stored.key);
    const result = await store.download(stored.key);
    expect(result).toBeUndefined();
  });

  it('generates a signed URL', async () => {
    const store = R2FileStore.createMock();
    const stored = await store.upload(makeParsedFile());

    const url = await store.getSignedUrl(stored.key);
    expect(url).toContain('r2.example.com');
    expect(url).toContain('expires=');
  });
});
