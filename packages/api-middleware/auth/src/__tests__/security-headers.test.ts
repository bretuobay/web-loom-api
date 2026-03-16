import { describe, it, expect } from 'vitest';
import { securityHeaders } from '../security-headers';
import type { RequestContext, NextFunction } from '@web-loom/api-core';

function makeCtx(): RequestContext {
  return {
    request: new Request('http://localhost/test'),
    params: {},
    query: {},
    body: null,
    metadata: new Map(),
  };
}

function makeNext(
  status = 200,
  body = 'ok',
  extraHeaders?: Record<string, string>,
): NextFunction {
  return async () => {
    const h = new Headers({ 'Content-Type': 'text/plain' });
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        h.set(k, v);
      }
    }
    return new Response(body, { status, headers: h });
  };
}

describe('securityHeaders', () => {
  it('sets all default security headers', async () => {
    const mw = securityHeaders();
    const res = await mw(makeCtx(), makeNext());

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('0');
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
  });

  it('removes X-Powered-By and Server headers by default', async () => {
    const mw = securityHeaders();
    const res = await mw(
      makeCtx(),
      makeNext(200, 'ok', { 'X-Powered-By': 'Express', Server: 'nginx' }),
    );

    expect(res.headers.has('X-Powered-By')).toBe(false);
    expect(res.headers.has('Server')).toBe(false);
  });

  it('allows overriding individual headers', async () => {
    const mw = securityHeaders({
      frameOptions: 'SAMEORIGIN',
      contentSecurityPolicy: "default-src 'self'; img-src *",
    });
    const res = await mw(makeCtx(), makeNext());

    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'self'; img-src *",
    );
    // Others still default
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('disables a header when set to false', async () => {
    const mw = securityHeaders({ xssProtection: false, frameOptions: false });
    const res = await mw(makeCtx(), makeNext());

    expect(res.headers.has('X-XSS-Protection')).toBe(false);
    expect(res.headers.has('X-Frame-Options')).toBe(false);
    // Others still present
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('applies custom headers', async () => {
    const mw = securityHeaders({
      customHeaders: { 'X-Custom': 'value' },
    });
    const res = await mw(makeCtx(), makeNext());

    expect(res.headers.get('X-Custom')).toBe('value');
  });

  it('preserves response status and body', async () => {
    const mw = securityHeaders();
    const res = await mw(makeCtx(), makeNext(201, 'created'));

    expect(res.status).toBe(201);
    expect(await res.text()).toBe('created');
  });

  it('keeps X-Powered-By when removePoweredBy is false', async () => {
    const mw = securityHeaders({ removePoweredBy: false });
    const res = await mw(
      makeCtx(),
      makeNext(200, 'ok', { 'X-Powered-By': 'Express' }),
    );

    expect(res.headers.get('X-Powered-By')).toBe('Express');
  });
});
