import { describe, it, expect } from 'vitest';
import {
  sanitize,
  sanitizeObject,
  isPathTraversal,
  requestSizeLimit,
} from '../sanitization';
import type { RequestContext, NextFunction } from '@web-loom/api-core';

// ---------------------------------------------------------------------------
// sanitize
// ---------------------------------------------------------------------------

describe('sanitize', () => {
  it('escapes HTML special characters', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(sanitize('a & b')).toBe('a &amp; b');
  });

  it('escapes single quotes', () => {
    expect(sanitize("it's")).toBe('it&#x27;s');
  });

  it('returns plain strings unchanged', () => {
    expect(sanitize('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// sanitizeObject
// ---------------------------------------------------------------------------

describe('sanitizeObject', () => {
  it('sanitizes string values in an object', () => {
    const result = sanitizeObject({ name: '<b>bold</b>', age: 30 });
    expect(result).toEqual({ name: '&lt;b&gt;bold&lt;/b&gt;', age: 30 });
  });

  it('recursively sanitizes nested objects', () => {
    const result = sanitizeObject({ user: { bio: '<em>hi</em>' } });
    expect(result).toEqual({ user: { bio: '&lt;em&gt;hi&lt;/em&gt;' } });
  });

  it('sanitizes arrays of strings', () => {
    const result = sanitizeObject(['<a>', 'ok']);
    expect(result).toEqual(['&lt;a&gt;', 'ok']);
  });

  it('preserves non-string primitives', () => {
    expect(sanitizeObject(42)).toBe(42);
    expect(sanitizeObject(true)).toBe(true);
    expect(sanitizeObject(null)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// isPathTraversal
// ---------------------------------------------------------------------------

describe('isPathTraversal', () => {
  it('detects ../ patterns', () => {
    expect(isPathTraversal('../etc/passwd')).toBe(true);
    expect(isPathTraversal('foo/../../bar')).toBe(true);
  });

  it('detects ..\\ patterns', () => {
    expect(isPathTraversal('..\\windows\\system32')).toBe(true);
  });

  it('detects encoded traversal', () => {
    expect(isPathTraversal('%2e%2e/etc/passwd')).toBe(true);
  });

  it('detects null bytes', () => {
    expect(isPathTraversal('file.txt\0.jpg')).toBe(true);
  });

  it('detects standalone ..', () => {
    expect(isPathTraversal('..')).toBe(true);
  });

  it('allows safe paths', () => {
    expect(isPathTraversal('users/123')).toBe(false);
    expect(isPathTraversal('/api/v1/items')).toBe(false);
    expect(isPathTraversal('file.test.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requestSizeLimit
// ---------------------------------------------------------------------------

function makeCtx(contentLength?: string): RequestContext {
  const headers: Record<string, string> = {};
  if (contentLength !== undefined) {
    headers['Content-Length'] = contentLength;
  }
  return {
    request: new Request('http://localhost/test', { headers }),
    params: {},
    query: {},
    body: null,
    metadata: new Map(),
  };
}

const passNext: NextFunction = async () =>
  new Response('ok', { status: 200 });

describe('requestSizeLimit', () => {
  it('allows requests within the limit', async () => {
    const mw = requestSizeLimit(1024);
    const res = await mw(makeCtx('512'), passNext);
    expect(res.status).toBe(200);
  });

  it('rejects requests exceeding the limit with 413', async () => {
    const mw = requestSizeLimit(1024);
    const res = await mw(makeCtx('2048'), passNext);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.maxBytes).toBe(1024);
  });

  it('allows requests without Content-Length header', async () => {
    const mw = requestSizeLimit(1024);
    const res = await mw(makeCtx(), passNext);
    expect(res.status).toBe(200);
  });

  it('uses 1 MB default limit', async () => {
    const mw = requestSizeLimit();
    // Just under 1 MB
    const res = await mw(makeCtx('1048575'), passNext);
    expect(res.status).toBe(200);

    // Over 1 MB
    const res2 = await mw(makeCtx('1048577'), passNext);
    expect(res2.status).toBe(413);
  });
});
