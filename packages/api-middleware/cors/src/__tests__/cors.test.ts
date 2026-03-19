import { describe, it, expect } from 'vitest';
import { cors } from '../cors';
import type { RequestContext, NextFunction } from '@web-loom/api-shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContext(
  overrides: Partial<RequestContext> & { method?: string; headers?: Record<string, string> } = {}
): RequestContext {
  const { method = 'GET', headers: extraHeaders = {}, ...rest } = overrides;
  const hdrs = new Headers(extraHeaders);
  const request = new Request('http://localhost:3000/test', { method, headers: hdrs });
  return {
    request,
    params: {},
    query: {},
    body: undefined,
    metadata: new Map(),
    ...rest,
  };
}

function okNext(): NextFunction {
  return async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}

function preflightContext(
  origin: string,
  requestMethod = 'POST',
  requestHeaders?: string
): RequestContext {
  const headers: Record<string, string> = {
    Origin: origin,
    'Access-Control-Request-Method': requestMethod,
  };
  if (requestHeaders) {
    headers['Access-Control-Request-Headers'] = requestHeaders;
  }
  return createContext({ method: 'OPTIONS', headers });
}

function actualContext(origin: string, method = 'GET'): RequestContext {
  return createContext({ method, headers: { Origin: origin } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cors middleware', () => {
  // ---- Default / wildcard origin ----

  it('adds wildcard Access-Control-Allow-Origin for default options', async () => {
    const mw = cors();
    const res = await mw(actualContext('https://example.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('passes through requests without Origin header', async () => {
    const mw = cors();
    const res = await mw(createContext(), okNext());
    // No CORS headers when no Origin
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  // ---- Preflight handling ----

  it('responds to preflight with 204 and CORS headers', async () => {
    const mw = cors();
    const ctx = preflightContext('https://example.com', 'POST', 'Content-Type');
    const res = await mw(ctx, okNext());

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    expect(res.headers.get('Content-Length')).toBe('0');
  });

  it('reflects requested headers when allowedHeaders is not configured', async () => {
    const mw = cors();
    const ctx = preflightContext('https://example.com', 'PUT', 'X-Custom, Authorization');
    const res = await mw(ctx, okNext());
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('X-Custom, Authorization');
  });

  it('uses configured allowedHeaders instead of reflecting', async () => {
    const mw = cors({ allowedHeaders: ['Content-Type', 'Authorization'] });
    const ctx = preflightContext('https://example.com', 'POST', 'X-Custom');
    const res = await mw(ctx, okNext());
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('sets Access-Control-Max-Age when configured', async () => {
    const mw = cors({ maxAge: 86400 });
    const ctx = preflightContext('https://example.com');
    const res = await mw(ctx, okNext());
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('passes preflight to next handler when preflightContinue is true', async () => {
    let nextCalled = false;
    const mw = cors({ preflightContinue: true });
    const ctx = preflightContext('https://example.com');
    const next: NextFunction = async () => {
      nextCalled = true;
      return new Response(null, { status: 200 });
    };
    await mw(ctx, next);
    expect(nextCalled).toBe(true);
  });

  // ---- Origin validation ----

  it('allows exact string origin match', async () => {
    const mw = cors({ origin: 'https://allowed.com' });
    const res = await mw(actualContext('https://allowed.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.com');
  });

  it('rejects non-matching string origin', async () => {
    const mw = cors({ origin: 'https://allowed.com' });
    const res = await mw(actualContext('https://evil.com'), okNext());
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('allows regex origin match', async () => {
    const mw = cors({ origin: /\.example\.com$/ });
    const res = await mw(actualContext('https://app.example.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });

  it('rejects non-matching regex origin', async () => {
    const mw = cors({ origin: /\.example\.com$/ });
    const res = await mw(actualContext('https://evil.com'), okNext());
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('allows origin from string array whitelist', async () => {
    const mw = cors({ origin: ['https://a.com', 'https://b.com'] });
    const res = await mw(actualContext('https://b.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://b.com');
  });

  it('rejects origin not in string array whitelist', async () => {
    const mw = cors({ origin: ['https://a.com', 'https://b.com'] });
    const res = await mw(actualContext('https://c.com'), okNext());
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('allows origin matching regex array', async () => {
    const mw = cors({ origin: [/^https:\/\/.*\.example\.com$/] });
    const res = await mw(actualContext('https://app.example.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });

  it('allows origin via custom function', async () => {
    const mw = cors({ origin: (o) => o.endsWith('.test.com') });
    const res = await mw(actualContext('https://app.test.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test.com');
  });

  it('rejects origin via custom function', async () => {
    const mw = cors({ origin: (o) => o.endsWith('.test.com') });
    const res = await mw(actualContext('https://evil.com'), okNext());
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('supports async custom origin function', async () => {
    const mw = cors({ origin: async (o) => o === 'https://async.com' });
    const res = await mw(actualContext('https://async.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://async.com');
  });

  // ---- Credentials ----

  it('sets Access-Control-Allow-Credentials when credentials is true', async () => {
    const mw = cors({ origin: 'https://app.com', credentials: true });
    const res = await mw(actualContext('https://app.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('reflects request origin instead of wildcard when credentials is true', async () => {
    const mw = cors({ origin: '*', credentials: true });
    const res = await mw(actualContext('https://app.com'), okNext());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.com');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  // ---- Exposed headers ----

  it('sets Access-Control-Expose-Headers on actual requests', async () => {
    const mw = cors({ exposedHeaders: ['X-Request-Id', 'X-Total-Count'] });
    const res = await mw(actualContext('https://example.com'), okNext());
    expect(res.headers.get('Access-Control-Expose-Headers')).toBe('X-Request-Id, X-Total-Count');
  });

  // ---- Vary header ----

  it('includes Vary: Origin on actual responses', async () => {
    const mw = cors();
    const res = await mw(actualContext('https://example.com'), okNext());
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('includes Vary on preflight responses', async () => {
    const mw = cors();
    const ctx = preflightContext('https://example.com');
    const res = await mw(ctx, okNext());
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  // ---- Custom methods ----

  it('uses configured methods in preflight response', async () => {
    const mw = cors({ methods: ['GET', 'POST'] });
    const ctx = preflightContext('https://example.com');
    const res = await mw(ctx, okNext());
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
  });
});
