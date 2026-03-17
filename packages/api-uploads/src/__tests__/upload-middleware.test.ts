import { describe, expect, it } from 'vitest';
import {
  extractBoundary,
  fileUpload,
  parseMultipart,
} from '../upload-middleware';
import type { ResolvedFileUploadOptions } from '../types';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

const DEFAULT_OPTIONS: ResolvedFileUploadOptions = {
  maxFileSize: 5 * 1024 * 1024,
  maxFiles: 10,
  allowedMimeTypes: [],
};

function buildMultipartBody(
  boundary: string,
  parts: Array<{
    name: string;
    filename?: string;
    contentType?: string;
    content: string | Buffer;
  }>,
): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`,
        ),
      );
      chunks.push(
        Buffer.from(`Content-Type: ${part.contentType ?? 'application/octet-stream'}\r\n`),
      );
    } else {
      chunks.push(
        Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n`),
      );
    }
    chunks.push(Buffer.from('\r\n'));
    chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

// -----------------------------------------------------------------------
// extractBoundary
// -----------------------------------------------------------------------

describe('extractBoundary', () => {
  it('extracts boundary from standard header', () => {
    expect(
      extractBoundary('multipart/form-data; boundary=----WebKitFormBoundary'),
    ).toBe('----WebKitFormBoundary');
  });

  it('extracts quoted boundary', () => {
    expect(
      extractBoundary('multipart/form-data; boundary="abc123"'),
    ).toBe('abc123');
  });

  it('returns undefined for non-multipart content type', () => {
    expect(extractBoundary('application/json')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------
// parseMultipart
// -----------------------------------------------------------------------

describe('parseMultipart', () => {
  const boundary = 'testboundary';

  it('parses a single file', () => {
    const body = buildMultipartBody(boundary, [
      { name: 'file', filename: 'test.txt', contentType: 'text/plain', content: 'hello world' },
    ]);

    const { result, error } = parseMultipart(body, boundary, DEFAULT_OPTIONS);
    expect(error).toBeUndefined();
    expect(result?.files).toHaveLength(1);
    expect(result?.files[0]?.name).toBe('test.txt');
    expect(result?.files[0]?.type).toBe('text/plain');
    expect(result?.files[0]?.buffer.toString()).toBe('hello world');
    expect(result?.files[0]?.size).toBe(11);
  });

  it('parses text fields alongside files', () => {
    const body = buildMultipartBody(boundary, [
      { name: 'description', content: 'My file' },
      { name: 'file', filename: 'photo.png', contentType: 'image/png', content: 'PNG_DATA' },
    ]);

    const { result } = parseMultipart(body, boundary, DEFAULT_OPTIONS);
    expect(result?.fields['description']).toBe('My file');
    expect(result?.files).toHaveLength(1);
    expect(result?.files[0]?.name).toBe('photo.png');
  });

  it('rejects files exceeding maxFileSize', () => {
    const bigContent = Buffer.alloc(100);
    const body = buildMultipartBody(boundary, [
      { name: 'file', filename: 'big.bin', content: bigContent },
    ]);

    const { error } = parseMultipart(body, boundary, { ...DEFAULT_OPTIONS, maxFileSize: 50 });
    expect(error?.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects when too many files', () => {
    const body = buildMultipartBody(boundary, [
      { name: 'f1', filename: 'a.txt', content: 'a' },
      { name: 'f2', filename: 'b.txt', content: 'b' },
    ]);

    const { error } = parseMultipart(body, boundary, { ...DEFAULT_OPTIONS, maxFiles: 1 });
    expect(error?.code).toBe('TOO_MANY_FILES');
  });

  it('rejects disallowed MIME types', () => {
    const body = buildMultipartBody(boundary, [
      { name: 'file', filename: 'script.js', contentType: 'application/javascript', content: 'x' },
    ]);

    const { error } = parseMultipart(body, boundary, {
      ...DEFAULT_OPTIONS,
      allowedMimeTypes: ['image/png', 'image/jpeg'],
    });
    expect(error?.code).toBe('INVALID_MIME_TYPE');
  });

  it('allows files matching allowedMimeTypes', () => {
    const body = buildMultipartBody(boundary, [
      { name: 'file', filename: 'photo.png', contentType: 'image/png', content: 'PNG' },
    ]);

    const { result, error } = parseMultipart(body, boundary, {
      ...DEFAULT_OPTIONS,
      allowedMimeTypes: ['image/png'],
    });
    expect(error).toBeUndefined();
    expect(result?.files).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------
// fileUpload middleware
// -----------------------------------------------------------------------

describe('fileUpload', () => {
  const boundary = 'myboundary';

  it('returns error for non-multipart requests', async () => {
    const handler = fileUpload();
    const { error } = await handler({
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{}'),
    });
    expect(error?.code).toBe('INVALID_CONTENT_TYPE');
  });

  it('parses a valid multipart request with Buffer body', async () => {
    const handler = fileUpload({ maxFileSize: 1024 });
    const body = buildMultipartBody(boundary, [
      { name: 'avatar', filename: 'me.jpg', contentType: 'image/jpeg', content: 'JPEG_DATA' },
    ]);

    const { result, error } = await handler({
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    expect(error).toBeUndefined();
    expect(result?.files).toHaveLength(1);
    expect(result?.files[0]?.name).toBe('me.jpg');
  });

  it('works with Headers object (Web standard)', async () => {
    const handler = fileUpload();
    const body = buildMultipartBody(boundary, [
      { name: 'doc', filename: 'readme.md', contentType: 'text/markdown', content: '# Hello' },
    ]);

    const headers = new Headers();
    headers.set('content-type', `multipart/form-data; boundary=${boundary}`);

    const { result } = await handler({
      headers,
      body,
    });

    expect(result?.files).toHaveLength(1);
  });

  it('supports arrayBuffer() for Web Request-like objects', async () => {
    const handler = fileUpload();
    const body = buildMultipartBody(boundary, [
      { name: 'file', filename: 'data.csv', contentType: 'text/csv', content: 'a,b,c' },
    ]);

    const { result } = await handler({
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    });

    expect(result?.files).toHaveLength(1);
    expect(result?.files[0]?.name).toBe('data.csv');
  });
});
