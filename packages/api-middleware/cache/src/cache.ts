/**
 * Response Caching Middleware
 *
 * Caches GET request responses with configurable TTL, automatic invalidation
 * on mutations, stale-while-revalidate support, and Cache-Control header
 * directive handling.
 *
 * @example
 * ```typescript
 * import { cache } from '@web-loom/api-middleware-cache';
 *
 * // Default: cache GET responses for 60s
 * app.use(cache());
 *
 * // Custom TTL + stale-while-revalidate
 * app.use(cache({
 *   ttl: 300_000,
 *   staleWhileRevalidate: 60_000,
 * }));
 *
 * // Redis store for production
 * app.use(cache({
 *   store: new RedisCacheStore({ client: redis }),
 * }));
 * ```
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';
import type {
  CacheOptions,
  ResolvedCacheOptions,
  CachedResponse,
} from './types';
import { MemoryCacheStore } from './stores/memory-store';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Default cache key: METHOD:URL */
function defaultKeyGenerator(request: Request): string {
  const url = new URL(request.url);
  return `${request.method}:${url.pathname}${url.search}`;
}

/** Extract the resource path from a URL */
function getResourcePath(url: string): string {
  return new URL(url).pathname;
}

// --------------------------------------------------------------------------
// Option resolution
// --------------------------------------------------------------------------

function resolveOptions(opts: CacheOptions = {}): ResolvedCacheOptions {
  return {
    ttl: opts.ttl ?? 60_000,
    methods: opts.methods ?? ['GET'],
    varyHeaders: opts.varyHeaders ?? [],
    store: opts.store ?? new MemoryCacheStore(),
    keyPrefix: opts.keyPrefix ?? 'cache:',
    keyGenerator: opts.keyGenerator ?? defaultKeyGenerator,
    autoInvalidate: opts.autoInvalidate ?? true,
    staleWhileRevalidate: opts.staleWhileRevalidate ?? 0,
    respectCacheControl: opts.respectCacheControl ?? true,
    cacheableStatuses: opts.cacheableStatuses ?? [200],
  };
}

// --------------------------------------------------------------------------
// Cache key generation with vary headers
// --------------------------------------------------------------------------

function buildCacheKey(
  request: Request,
  config: ResolvedCacheOptions,
): string {
  const baseKey = config.keyGenerator(request);

  if (config.varyHeaders.length === 0) {
    return config.keyPrefix + baseKey;
  }

  const varyParts = config.varyHeaders
    .map((h) => `${h}=${request.headers.get(h) ?? ''}`)
    .join('&');

  return config.keyPrefix + baseKey + '|' + varyParts;
}

// --------------------------------------------------------------------------
// Cache-Control parsing
// --------------------------------------------------------------------------

interface CacheControlDirectives {
  noCache: boolean;
  noStore: boolean;
  maxAge: number | undefined;
}

function parseCacheControl(header: string | null): CacheControlDirectives {
  const result: CacheControlDirectives = {
    noCache: false,
    noStore: false,
    maxAge: undefined,
  };

  if (!header) return result;

  const directives = header.toLowerCase().split(',').map((d) => d.trim());

  for (const directive of directives) {
    if (directive === 'no-cache') {
      result.noCache = true;
    } else if (directive === 'no-store') {
      result.noStore = true;
    } else if (directive.startsWith('max-age=')) {
      const value = parseInt(directive.slice(8), 10);
      if (!isNaN(value)) {
        result.maxAge = value * 1000; // convert to ms
      }
    }
  }

  return result;
}

// --------------------------------------------------------------------------
// Response serialization
// --------------------------------------------------------------------------

async function serializeResponse(
  response: Response,
  now: number,
  ttlMs: number,
): Promise<CachedResponse> {
  const body = await response.text();
  const headers: [string, string][] = [];
  response.headers.forEach((value, key) => {
    headers.push([key, value]);
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}

function deserializeResponse(
  cached: CachedResponse,
  cacheStatus: 'HIT' | 'STALE',
): Response {
  const headers = new Headers(cached.headers);
  headers.set('X-Cache', cacheStatus);

  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

// --------------------------------------------------------------------------
// Mutation methods for auto-invalidation
// --------------------------------------------------------------------------

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// --------------------------------------------------------------------------
// Response helper
// --------------------------------------------------------------------------

function withCacheHeader(response: Response, value: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Cache', value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// --------------------------------------------------------------------------
// Middleware factory
// --------------------------------------------------------------------------

/**
 * Create response caching middleware.
 *
 * Caches responses for configured HTTP methods (default: GET only).
 * Supports configurable TTL, vary headers, auto-invalidation on mutations,
 * stale-while-revalidate, and Cache-Control header directives.
 *
 * Headers added to every response:
 * - `X-Cache: HIT` — served from cache
 * - `X-Cache: MISS` — fetched from origin
 * - `X-Cache: STALE` — served stale while revalidating
 *
 * @param options - Cache configuration
 * @returns Middleware function
 */
export function cache(
  options: CacheOptions = {},
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const config = resolveOptions(options);
  const cacheableMethods = new Set(config.methods.map((m) => m.toUpperCase()));

  /** Compute the store TTL (includes SWR window so store doesn't evict stale entries) */
  function storeTtl(effectiveTtl: number): number {
    return effectiveTtl + config.staleWhileRevalidate;
  }

  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const { request } = ctx;
    const method = request.method.toUpperCase();

    // --- Auto-invalidation on mutation requests ---
    if (config.autoInvalidate && MUTATION_METHODS.has(method)) {
      const resourcePath = getResourcePath(request.url);
      // Invalidate all cached GET entries for this resource path
      await config.store.clear(config.keyPrefix + 'GET:' + resourcePath);

      const response = await next();
      return withCacheHeader(response, 'MISS');
    }

    // --- Only cache configured methods ---
    if (!cacheableMethods.has(method)) {
      return next();
    }

    // --- Respect Cache-Control request headers ---
    if (config.respectCacheControl) {
      const cc = parseCacheControl(request.headers.get('cache-control'));
      if (cc.noStore) {
        const response = await next();
        return withCacheHeader(response, 'MISS');
      }

      if (cc.noCache) {
        // Skip cache lookup, but still store the response
        const response = await next();
        const now = Date.now();
        const ttl = cc.maxAge ?? config.ttl;

        if (config.cacheableStatuses.includes(response.status)) {
          const key = buildCacheKey(request, config);
          const cached = await serializeResponse(response.clone(), now, ttl);
          await config.store.set(key, cached, storeTtl(ttl));
        }

        return withCacheHeader(response, 'MISS');
      }
    }

    const key = buildCacheKey(request, config);
    const now = Date.now();

    // --- Cache lookup ---
    const cached = await config.store.get(key);

    if (cached) {
      // Check if entry is still fresh
      if (now < cached.expiresAt) {
        return deserializeResponse(cached, 'HIT');
      }

      // Entry is expired but still in store (within SWR window)
      if (
        config.staleWhileRevalidate > 0 &&
        now < cached.expiresAt + config.staleWhileRevalidate
      ) {
        // Serve stale response, revalidate in background
        revalidateInBackground(next, key, config, storeTtl);
        return deserializeResponse(cached, 'STALE');
      }
    }

    // --- Cache miss: fetch from origin ---
    const response = await next();

    // Determine effective TTL
    let effectiveTtl = config.ttl;
    if (config.respectCacheControl) {
      const cc = parseCacheControl(request.headers.get('cache-control'));
      if (cc.maxAge !== undefined) {
        effectiveTtl = cc.maxAge;
      }
    }

    // Only cache successful responses
    if (config.cacheableStatuses.includes(response.status)) {
      const serialized = await serializeResponse(response.clone(), now, effectiveTtl);
      await config.store.set(key, serialized, storeTtl(effectiveTtl));
    }

    return withCacheHeader(response, 'MISS');
  };
}

// --------------------------------------------------------------------------
// Background revalidation (fire-and-forget)
// --------------------------------------------------------------------------

function revalidateInBackground(
  next: NextFunction,
  key: string,
  config: ResolvedCacheOptions,
  storeTtl: (ttl: number) => number,
): void {
  void (async () => {
    try {
      const response = await next();
      const now = Date.now();
      if (config.cacheableStatuses.includes(response.status)) {
        const serialized = await serializeResponse(response, now, config.ttl);
        await config.store.set(key, serialized, storeTtl(config.ttl));
      }
    } catch {
      // Silently ignore revalidation errors
    }
  })();
}
