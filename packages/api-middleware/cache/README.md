# @web-loom/api-middleware-cache

Response caching middleware for [Web Loom API](https://github.com/bretuobay/web-loom-api). Supports configurable TTL, tag-based invalidation, stale-while-revalidate, and pluggable backends (in-memory, Redis).

## Installation

```bash
npm install @web-loom/api-middleware-cache hono
```

For Redis backend:

```bash
npm install ioredis
```

## Usage

### Basic Caching

```typescript
import { cache } from '@web-loom/api-middleware-cache';
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

// Cache GET /posts for 60 seconds
routes.get('/posts', cache({ ttl: 60 }), async (c) => {
  const posts = await c.var.db.select().from(postsTable);
  return c.json({ posts });
});

// Cache with tags for granular invalidation
routes.get('/posts/:id', cache({ ttl: 120, tags: ['posts'] }), async (c) => {
  const [post] = await c.var.db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, c.req.param('id')));
  return c.json({ post });
});
```

### Tag-Based Invalidation

```typescript
import { CacheManager } from '@web-loom/api-middleware-cache';

const cacheManager = new CacheManager();

// On POST /posts — invalidate all cached post responses
routes.post('/posts', authenticate, async (c) => {
  const [post] = await c.var.db.insert(postsTable).values(data).returning();
  await cacheManager.invalidateByTag('posts');
  return c.json({ post }, 201);
});
```

### Redis Backend

```typescript
import { cache, RedisCacheStore } from '@web-loom/api-middleware-cache';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);
const store = new RedisCacheStore(redis);

routes.get('/posts', cache({ ttl: 60, store }), handler);
```

### Stale-While-Revalidate

```typescript
routes.get(
  '/leaderboard',
  cache({
    ttl: 30,
    staleWhileRevalidate: 300, // serve stale for 5 min while refreshing
  }),
  handler
);
```

## Options

| Option                 | Type         | Default   | Description                               |
| ---------------------- | ------------ | --------- | ----------------------------------------- |
| `ttl`                  | `number`     | `60`      | Cache duration in seconds                 |
| `tags`                 | `string[]`   | `[]`      | Tags for grouped invalidation             |
| `store`                | `CacheStore` | in-memory | Storage backend                           |
| `staleWhileRevalidate` | `number`     | `0`       | Seconds to serve stale while revalidating |
| `keyPrefix`            | `string`     | `'wl:'`   | Cache key prefix                          |
| `vary`                 | `string[]`   | `[]`      | Vary headers to include in cache key      |

## `CacheManager` API

```typescript
const manager = new CacheManager(store?);

await manager.get(key);
await manager.set(key, value, ttl);
await manager.delete(key);
await manager.invalidateByTag(tag);
await manager.flush();
```

## License

MIT
