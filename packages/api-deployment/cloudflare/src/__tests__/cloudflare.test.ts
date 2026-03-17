import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCloudflareHandler, resolveKVBinding, resolveD1Binding } from '../cloudflare-handler';
import { CloudflareKVStore } from '../kv-store';
import { CloudflareD1Adapter } from '../d1-adapter';
import { WebSocketDurableObject } from '../durable-objects';
import { WorkersAIHelper } from '../workers-ai';
import type { WebLoomApp, CloudflareEnv, ExecutionContext, KVNamespace, D1Database, D1PreparedStatement, AiBinding } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApp(response?: Response): WebLoomApp {
  return {
    handle: vi.fn().mockResolvedValue(
      response ?? new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  };
}

function createMockExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

function createMockKV(store: Map<string, string> = new Map()): KVNamespace {
  return {
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const raw = store.get(key) ?? null;
      if (raw === null) return null;
      if (options?.type === 'json') return JSON.parse(raw);
      return raw;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, typeof value === 'string' ? value : String(value));
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys = Array.from(store.keys())
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    }),
  } as unknown as KVNamespace;
}


function createMockD1(): { db: D1Database; data: Map<string, unknown[]> } {
  const data = new Map<string, unknown[]>();

  const createStatement = (_sql: string): D1PreparedStatement => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _boundParams: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        _boundParams = values;
        return stmt;
      },
      first: vi.fn(async () => ({ id: 1, name: 'test' })),
      run: vi.fn(async () => ({
        results: [],
        success: true,
        meta: { duration: 1, changes: 1, last_row_id: 1, served_by: 'mock' },
      })),
      all: vi.fn(async () => ({
        results: [{ id: 1, name: 'test' }],
        success: true,
        meta: { duration: 1, changes: 0, last_row_id: 0, served_by: 'mock' },
      })),
      raw: vi.fn(async () => [[1, 'test']]),
    };
    return stmt;
  };

  const db: D1Database = {
    prepare: vi.fn((sql: string) => createStatement(sql)),
    exec: vi.fn(async () => ({ count: 1, duration: 1 })),
    batch: vi.fn(async (stmts: D1PreparedStatement[]) =>
      stmts.map(() => ({
        results: [],
        success: true,
        meta: { duration: 1, changes: 1, last_row_id: 1, served_by: 'mock' },
      })),
    ),
  };

  return { db, data };
}

function createMockAI(): AiBinding {
  return {
    run: vi.fn(async (model: string, _inputs: Record<string, unknown>) => {
      if (model.includes('llama')) {
        return { response: 'Generated text response' };
      }
      if (model.includes('bge')) {
        return { data: [[0.1, 0.2, 0.3]] };
      }
      if (model.includes('resnet')) {
        return [{ label: 'cat', score: 0.95 }];
      }
      return {};
    }),
  };
}

// ---------------------------------------------------------------------------
// createCloudflareHandler
// ---------------------------------------------------------------------------

describe('createCloudflareHandler', () => {
  let app: WebLoomApp;
  let env: CloudflareEnv;
  let ctx: ExecutionContext;

  beforeEach(() => {
    app = createMockApp();
    env = {};
    ctx = createMockExecutionContext();
  });

  it('returns a function with Workers fetch handler signature', () => {
    const handler = createCloudflareHandler(app);
    expect(typeof handler).toBe('function');
  });

  it('delegates to app.handle and returns the response', async () => {
    const handler = createCloudflareHandler(app);
    const request = new Request('https://example.com/api/test');
    const response = await handler(request, env, ctx);

    expect(response.status).toBe(200);
    expect(app.handle).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it('sets x-cf-worker header on enriched request', async () => {
    const handler = createCloudflareHandler(app);
    const request = new Request('https://example.com/api/test');
    await handler(request, env, ctx);

    const passedRequest = (app.handle as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(passedRequest.headers.get('x-cf-worker')).toBe('true');
  });

  it('sets binding headers when env bindings are present', async () => {
    env['CACHE'] = createMockKV();
    env['DB'] = createMockD1().db;

    const handler = createCloudflareHandler(app, {
      kvNamespace: 'CACHE',
      d1Binding: 'DB',
    });
    const request = new Request('https://example.com/api/test');
    await handler(request, env, ctx);

    const passedRequest = (app.handle as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(passedRequest.headers.get('x-cf-kv-namespace')).toBe('CACHE');
    expect(passedRequest.headers.get('x-cf-d1-binding')).toBe('DB');
  });

  it('calls ctx.waitUntil', async () => {
    const handler = createCloudflareHandler(app);
    const request = new Request('https://example.com/api/test');
    await handler(request, env, ctx);

    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it('returns 500 JSON error when app.handle throws', async () => {
    const failApp: WebLoomApp = {
      handle: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const handler = createCloudflareHandler(failApp);
    const request = new Request('https://example.com/api/test');
    const response = await handler(request, env, ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('boom');
  });
});


// ---------------------------------------------------------------------------
// resolveKVBinding / resolveD1Binding
// ---------------------------------------------------------------------------

describe('resolveKVBinding', () => {
  it('returns KVNamespace when binding exists', () => {
    const kv = createMockKV();
    const env: CloudflareEnv = { CACHE: kv };
    expect(resolveKVBinding(env, 'CACHE')).toBe(kv);
  });

  it('returns null when binding is missing', () => {
    expect(resolveKVBinding({}, 'CACHE')).toBeNull();
  });
});

describe('resolveD1Binding', () => {
  it('returns D1Database when binding exists', () => {
    const { db } = createMockD1();
    const env: CloudflareEnv = { DB: db };
    expect(resolveD1Binding(env, 'DB')).toBe(db);
  });

  it('returns null when binding is missing', () => {
    expect(resolveD1Binding({}, 'DB')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CloudflareKVStore
// ---------------------------------------------------------------------------

describe('CloudflareKVStore', () => {
  let store: Map<string, string>;
  let kv: KVNamespace;
  let cache: CloudflareKVStore;

  beforeEach(() => {
    store = new Map();
    kv = createMockKV(store);
    cache = new CloudflareKVStore(kv);
  });

  it('get returns null for missing key', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  it('set stores a JSON-serialized value', async () => {
    await cache.set('key1', { hello: 'world' });
    expect(store.get('key1')).toBe('{"hello":"world"}');
  });

  it('get retrieves a stored value', async () => {
    store.set('key1', JSON.stringify({ hello: 'world' }));
    const value = await cache.get('key1');
    expect(value).toEqual({ hello: 'world' });
  });

  it('set passes expirationTtl when ttl is provided', async () => {
    await cache.set('key1', 'val', 3600);
    expect(kv.put).toHaveBeenCalledWith('key1', '"val"', { expirationTtl: 3600 });
  });

  it('delete returns true when key exists', async () => {
    store.set('key1', '"val"');
    expect(await cache.delete('key1')).toBe(true);
  });

  it('delete returns false when key is missing', async () => {
    expect(await cache.delete('missing')).toBe(false);
  });

  it('has returns true for existing key', async () => {
    store.set('key1', '"val"');
    expect(await cache.has('key1')).toBe(true);
  });

  it('has returns false for missing key', async () => {
    expect(await cache.has('missing')).toBe(false);
  });

  it('list returns keys with optional prefix', async () => {
    store.set('user:1', '"a"');
    store.set('user:2', '"b"');
    store.set('post:1', '"c"');
    const result = await cache.list('user:');
    expect(result.keys).toHaveLength(2);
    expect(result.keys.map((k) => k.name)).toEqual(['user:1', 'user:2']);
  });
});

// ---------------------------------------------------------------------------
// CloudflareD1Adapter
// ---------------------------------------------------------------------------

describe('CloudflareD1Adapter', () => {
  let db: D1Database;
  let adapter: CloudflareD1Adapter;

  beforeEach(() => {
    ({ db } = createMockD1());
    adapter = new CloudflareD1Adapter(db);
  });

  it('query returns results array', async () => {
    const results = await adapter.query('SELECT * FROM users');
    expect(results).toEqual([{ id: 1, name: 'test' }]);
    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('query binds parameters', async () => {
    await adapter.query('SELECT * FROM users WHERE id = ?', [1]);
    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
  });

  it('execute returns changes and lastRowId', async () => {
    const result = await adapter.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
    expect(result).toEqual({ changes: 1, lastRowId: 1 });
  });

  it('batch executes multiple statements atomically', async () => {
    const results = await adapter.batch([
      { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
      { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
    ]);
    expect(results).toHaveLength(2);
    expect(db.batch).toHaveBeenCalledOnce();
  });

  it('exec runs raw SQL', async () => {
    const result = await adapter.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    expect(result).toEqual({ count: 1, duration: 1 });
  });

  it('queryFirst returns a single row', async () => {
    const row = await adapter.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
    expect(row).toEqual({ id: 1, name: 'test' });
  });

  it('transaction delegates to the adapter', async () => {
    const result = await adapter.transaction(async (tx) => {
      return tx.query('SELECT 1');
    });
    expect(result).toEqual([{ id: 1, name: 'test' }]);
  });
});


// ---------------------------------------------------------------------------
// WebSocketDurableObject
// ---------------------------------------------------------------------------

describe('WebSocketDurableObject', () => {
  let durableObject: WebSocketDurableObject;

  beforeEach(() => {
    durableObject = new WebSocketDurableObject();
  });

  it('returns 426 when request is not a WebSocket upgrade', async () => {
    const request = new Request('https://example.com/ws');
    const response = await durableObject.handleWebSocket(request);
    expect(response.status).toBe(426);
  });

  it('getConnectionCount returns 0 initially', () => {
    expect(durableObject.getConnectionCount()).toBe(0);
  });

  it('getConnections returns empty array initially', () => {
    expect(durableObject.getConnections()).toEqual([]);
  });

  it('send returns false for non-existent connection', () => {
    expect(durableObject.send('999', 'hello')).toBe(false);
  });

  it('broadcast does not throw with no connections', () => {
    expect(() => durableObject.broadcast('hello')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// WorkersAIHelper
// ---------------------------------------------------------------------------

describe('WorkersAIHelper', () => {
  let ai: AiBinding;
  let helper: WorkersAIHelper;

  beforeEach(() => {
    ai = createMockAI();
    helper = new WorkersAIHelper(ai);
  });

  it('run delegates to the AI binding', async () => {
    await helper.run('@cf/test/model', { input: 'test' });
    expect(ai.run).toHaveBeenCalledWith('@cf/test/model', { input: 'test' });
  });

  it('textGeneration calls llama model with prompt', async () => {
    const result = await helper.textGeneration('Hello world');
    expect(result).toEqual({ response: 'Generated text response' });
    expect(ai.run).toHaveBeenCalledWith(
      '@cf/meta/llama-2-7b-chat-int8',
      expect.objectContaining({ prompt: 'Hello world' }),
    );
  });

  it('textGeneration passes options', async () => {
    await helper.textGeneration('Hello', { maxTokens: 100, temperature: 0.7 });
    expect(ai.run).toHaveBeenCalledWith(
      '@cf/meta/llama-2-7b-chat-int8',
      expect.objectContaining({
        prompt: 'Hello',
        max_tokens: 100,
        temperature: 0.7,
        stream: false,
      }),
    );
  });

  it('textEmbedding calls embedding model', async () => {
    const result = await helper.textEmbedding('test text');
    expect(result).toEqual({ data: [[0.1, 0.2, 0.3]] });
    expect(ai.run).toHaveBeenCalledWith(
      '@cf/baai/bge-base-en-v1.5',
      { text: ['test text'] },
    );
  });

  it('textEmbedding accepts array of strings', async () => {
    await helper.textEmbedding(['text1', 'text2']);
    expect(ai.run).toHaveBeenCalledWith(
      '@cf/baai/bge-base-en-v1.5',
      { text: ['text1', 'text2'] },
    );
  });

  it('imageClassification calls vision model', async () => {
    const imageData = new ArrayBuffer(8);
    const result = await helper.imageClassification(imageData);
    expect(result).toEqual([{ label: 'cat', score: 0.95 }]);
    expect(ai.run).toHaveBeenCalledWith(
      '@cf/microsoft/resnet-50',
      { image: imageData },
    );
  });
});
