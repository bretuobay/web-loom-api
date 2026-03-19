import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVercelHandler, loadVercelEnv, createStreamingResponse } from '../vercel-handler';
import { detectRuntime, isEdgeRuntime, createEdgeConfig, getOptimalRegions } from '../edge-runtime';
import { VercelKVCacheStore } from '../vercel-kv';
import type { WebLoomApp, VercelKVClient } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApp(response?: Response): WebLoomApp {
  return {
    handleRequest: vi.fn().mockResolvedValue(
      response ?? new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
  };
}

function createMockKVClient(store: Map<string, unknown> = new Map()): VercelKVClient {
  return {
    get: vi.fn(async <T = string>(key: string): Promise<T | null> => {
      return (store.get(key) as T) ?? null;
    }),
    set: vi.fn(async (key: string, value: unknown, _options?: { ex?: number }): Promise<string> => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string): Promise<number> => {
      return store.delete(key) ? 1 : 0;
    }),
    exists: vi.fn(async (key: string): Promise<number> => {
      return store.has(key) ? 1 : 0;
    }),
  };
}

// ---------------------------------------------------------------------------
// createVercelHandler
// ---------------------------------------------------------------------------

describe('createVercelHandler', () => {
  it('returns a function', () => {
    const handler = createVercelHandler(createMockApp());
    expect(typeof handler).toBe('function');
  });

  it('delegates to app.handleRequest and returns the response', async () => {
    const app = createMockApp();
    const handler = createVercelHandler(app);
    const req = new Request('https://example.com/api/test');

    const res = await handler(req);

    expect(app.handleRequest).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('enriches request with Vercel context headers', async () => {
    const app = createMockApp();
    const handler = createVercelHandler(app);
    const req = new Request('https://example.com/api/test');

    await handler(req);

    const passedReq = (app.handleRequest as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Request;
    expect(passedReq.headers.get('x-vercel-env')).toBeTruthy();
    expect(passedReq.headers.get('x-vercel-region')).toBeTruthy();
  });

  it('returns 500 JSON response when app.handleRequest throws', async () => {
    const app: WebLoomApp = {
      handleRequest: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const handler = createVercelHandler(app);
    const req = new Request('https://example.com/api/test');

    const res = await handler(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('boom');
  });

  it('returns generic message for non-Error throws', async () => {
    const app: WebLoomApp = {
      handleRequest: vi.fn().mockRejectedValue('string error'),
    };
    const handler = createVercelHandler(app);
    const req = new Request('https://example.com/api/test');

    const res = await handler(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe('Internal Server Error');
  });
});

// ---------------------------------------------------------------------------
// loadVercelEnv
// ---------------------------------------------------------------------------

describe('loadVercelEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no VERCEL_* vars are set', () => {
    delete process.env['VERCEL_ENV'];
    delete process.env['VERCEL_URL'];
    delete process.env['VERCEL_REGION'];
    const config = loadVercelEnv();
    expect(config.env).toBe('development');
    expect(config.url).toBe('localhost:3000');
    expect(config.region).toBe('dev1');
  });

  it('reads VERCEL_* environment variables', () => {
    process.env['VERCEL_ENV'] = 'production';
    process.env['VERCEL_URL'] = 'my-app.vercel.app';
    process.env['VERCEL_REGION'] = 'iad1';
    process.env['VERCEL_GIT_COMMIT_SHA'] = 'abc123';
    process.env['VERCEL_GIT_COMMIT_REF'] = 'main';

    const config = loadVercelEnv();

    expect(config.env).toBe('production');
    expect(config.url).toBe('my-app.vercel.app');
    expect(config.region).toBe('iad1');
    expect(config.gitCommitSha).toBe('abc123');
    expect(config.gitCommitRef).toBe('main');
  });

  it('loads custom-prefixed environment variables', () => {
    process.env['MYAPP_DB_HOST'] = 'db.example.com';
    process.env['MYAPP_DB_PORT'] = '5432';
    process.env['OTHER_VAR'] = 'ignored';

    const config = loadVercelEnv('MYAPP');

    expect(config.custom['DB_HOST']).toBe('db.example.com');
    expect(config.custom['DB_PORT']).toBe('5432');
    expect(config.custom['OTHER_VAR']).toBeUndefined();
  });

  it('handles prefix with trailing underscore', () => {
    process.env['APP_KEY'] = 'value';

    const config = loadVercelEnv('APP_');

    expect(config.custom['KEY']).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// createStreamingResponse
// ---------------------------------------------------------------------------

describe('createStreamingResponse', () => {
  it('returns the original response if body is null', () => {
    const original = new Response(null, { status: 204 });
    const result = createStreamingResponse(original);
    expect(result).toBe(original);
  });

  it('wraps a body through a TransformStream', async () => {
    const original = new Response('hello streaming', { status: 200 });
    const streamed = createStreamingResponse(original);

    expect(streamed.status).toBe(200);
    expect(streamed.headers.get('Transfer-Encoding')).toBe('chunked');

    const text = await streamed.text();
    expect(text).toBe('hello streaming');
  });
});

// ---------------------------------------------------------------------------
// Edge Runtime
// ---------------------------------------------------------------------------

describe('detectRuntime', () => {
  it('returns runtime from options when provided', () => {
    expect(detectRuntime({ runtime: 'edge' })).toBe('edge');
    expect(detectRuntime({ runtime: 'nodejs' })).toBe('nodejs');
  });

  it('defaults to nodejs when no edge global exists', () => {
    expect(detectRuntime()).toBe('nodejs');
  });
});

describe('isEdgeRuntime', () => {
  it('returns true for edge runtime option', () => {
    expect(isEdgeRuntime({ runtime: 'edge' })).toBe(true);
  });

  it('returns false for nodejs runtime option', () => {
    expect(isEdgeRuntime({ runtime: 'nodejs' })).toBe(false);
  });
});

describe('createEdgeConfig', () => {
  it('returns edge config with runtime set to edge', () => {
    const config = createEdgeConfig();
    expect(config.runtime).toBe('edge');
  });

  it('includes regions when provided', () => {
    const config = createEdgeConfig({ regions: ['iad1', 'sfo1'] });
    expect(config.runtime).toBe('edge');
    expect(config.regions).toEqual(['iad1', 'sfo1']);
  });
});

describe('getOptimalRegions', () => {
  it('returns default regions when no config provided', () => {
    const regions = getOptimalRegions();
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.length).toBeLessThanOrEqual(4);
  });

  it('returns explicit primary regions when provided', () => {
    const regions = getOptimalRegions({ primaryRegions: ['cdg1', 'hnd1'] });
    expect(regions).toEqual(['cdg1', 'hnd1']);
  });

  it('caps regions to maxRegions', () => {
    const regions = getOptimalRegions({
      primaryRegions: ['iad1', 'sfo1', 'cdg1', 'hnd1', 'sin1'],
      maxRegions: 2,
    });
    expect(regions).toEqual(['iad1', 'sfo1']);
  });

  it('returns fallback region when autoDetect is false and no primary regions', () => {
    const regions = getOptimalRegions({ autoDetect: false });
    expect(regions).toEqual(['iad1']);
  });
});

// ---------------------------------------------------------------------------
// VercelKVCacheStore
// ---------------------------------------------------------------------------

describe('VercelKVCacheStore', () => {
  let store: Map<string, unknown>;
  let client: VercelKVClient;
  let cache: VercelKVCacheStore;

  beforeEach(() => {
    store = new Map();
    client = createMockKVClient(store);
    cache = new VercelKVCacheStore(client);
  });

  it('get returns null for missing keys', async () => {
    const result = await cache.get('missing');
    expect(result).toBeNull();
  });

  it('set and get round-trip a value', async () => {
    await cache.set('key1', { data: 42 });
    const result = await cache.get('key1');
    expect(result).toEqual({ data: 42 });
  });

  it('set passes ttl as ex option', async () => {
    await cache.set('key2', 'val', 60);
    expect(client.set).toHaveBeenCalledWith('key2', 'val', { ex: 60 });
  });

  it('set omits options when no ttl', async () => {
    await cache.set('key3', 'val');
    expect(client.set).toHaveBeenCalledWith('key3', 'val', undefined);
  });

  it('delete returns true when key existed', async () => {
    store.set('key4', 'val');
    const result = await cache.delete('key4');
    expect(result).toBe(true);
  });

  it('delete returns false when key did not exist', async () => {
    const result = await cache.delete('nope');
    expect(result).toBe(false);
  });

  it('has returns true for existing keys', async () => {
    store.set('key5', 'val');
    const result = await cache.has('key5');
    expect(result).toBe(true);
  });

  it('has returns false for missing keys', async () => {
    const result = await cache.has('nope');
    expect(result).toBe(false);
  });
});
