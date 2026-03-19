# Performance Optimization

Strategies for minimizing cold starts, optimizing queries, and reducing bundle size.

## Cold Start Optimization

Serverless cold starts happen when a new instance is created. Web Loom targets < 100ms initialization.

### Lazy Email Loading

The email adapter is optional and initialized only when `c.var.email` is first accessed. Omitting it from config eliminates the import entirely from the cold start path:

```typescript
defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: 'neon-serverless' },
  // email: omit unless needed — zero cold start cost when absent
});
```

### Module-Scoped App Instance

Cache the app instance outside the handler so it persists across warm invocations:

```typescript
// Module scope — survives across invocations
let appPromise: ReturnType<typeof createApp> | null = null;

export function getApp() {
  if (!appPromise) {
    appPromise = createApp(config);
  }
  return appPromise;
}
```

### Minimal Dependencies

Keep your bundle small:

- Core runtime: < 50KB gzipped
- With Hono: < 65KB gzipped
- With Drizzle: < 80KB gzipped
- Full stack: < 150KB gzipped

### Bundle Analysis

```bash
npx webloom analyze
```

This shows a breakdown of your bundle by package, helping identify heavy dependencies.

## Connection Pooling

### Serverless (Neon)

Use `neon-serverless` — it uses HTTP connections, not TCP pools, so there is no pooling overhead and no connection limit to worry about:

```typescript
database: {
  url: process.env.DATABASE_URL!,
  driver: 'neon-serverless',  // HTTP — edge-safe, no pool
}
```

### Long-Running Servers (pg)

Use the `pg` driver with a pool appropriate for your concurrency:

```typescript
database: {
  url: process.env.DATABASE_URL!,
  driver: 'pg',
  poolSize: 10,
  connectionTimeout: 10_000,
  ssl: true,
}
```

### SQLite / Edge (libsql)

For Turso or local SQLite:

```typescript
database: {
  url: process.env.DATABASE_URL!,
  driver: 'libsql',
  connectionTimeout: 5_000,
}
```

## Response Caching

Use `@web-loom/api-middleware-cache` to cache GET responses:

```typescript
import { cache } from '@web-loom/api-middleware-cache';
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

// Cache GET /posts responses for 60 seconds
routes.get('/posts', cache({ ttl: 60_000 }), async (c) => {
  const posts = await c.var.db.select().from(postsTable).limit(20);
  return c.json({ posts });
});
```

### Cache Invalidation

Invalidate on mutation by clearing the cache store:

```typescript
import { MemoryCacheStore } from '@web-loom/api-middleware-cache';

const cacheStore = new MemoryCacheStore();

routes.post('/posts', async (c) => {
  const data = c.req.valid('json');
  const [post] = await c.var.db.insert(postsTable).values(data).returning();
  // Invalidate cached list
  await cacheStore.delete('GET:' + c.req.url.replace(/\/[^/]+$/, ''));
  return c.json({ post }, 201);
});
```

### Per-User Caching

When auth is applied before cache middleware, scope the cache key to include user ID:

```typescript
cache({
  ttl: 60_000,
  keyGenerator: (req) => {
    const userId = req.headers.get('x-user-id') ?? 'anonymous';
    return `${userId}:${req.method}:${new URL(req.url).pathname}`;
  },
});
```

## Query Optimization

### Avoid N+1 Queries

Use Drizzle joins instead of sequential selects:

```typescript
import { eq } from 'drizzle-orm';
import { postsTable, usersTable } from './schema';

// Bad: N+1 queries
const posts = await c.var.db.select().from(postsTable).limit(20);
for (const post of posts) {
  const [author] = await c.var.db.select().from(usersTable).where(eq(usersTable.id, post.authorId));
  post.author = author;
}

// Good: single query with JOIN
const postsWithAuthors = await c.var.db
  .select({
    post: postsTable,
    author: { name: usersTable.name, email: usersTable.email },
  })
  .from(postsTable)
  .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
  .limit(20);
```

### Cursor-Based Pagination

For large datasets, cursor-based pagination is more efficient than offset:

```bash
# Offset-based (slow for large offsets)
GET /posts?page=1000&limit=20

# Cursor-based (consistent performance)
GET /posts?cursor=abc123&limit=20
```

```typescript
import { gt, desc } from 'drizzle-orm';

routes.get('/posts', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') ?? '20'), 100);

  const posts = await c.var.db
    .select()
    .from(postsTable)
    .where(cursor ? gt(postsTable.id, cursor) : undefined)
    .orderBy(desc(postsTable.createdAt))
    .limit(limit + 1); // fetch one extra to detect next page

  const hasMore = posts.length > limit;
  return c.json({
    posts: posts.slice(0, limit),
    nextCursor: hasMore ? posts[limit - 1]?.id : null,
  });
});
```

### Field Selection

Only select the columns you need:

```typescript
const users = await c.var.db
  .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
  .from(usersTable)
  .limit(20);
```

### Prepared Statements

Drizzle supports prepared statements for frequently repeated queries:

```typescript
import { placeholder } from 'drizzle-orm';

const getUserById = db
  .select()
  .from(usersTable)
  .where(eq(usersTable.id, placeholder('id')))
  .prepare('get_user_by_id');

// Reuse the prepared statement
const [user] = await getUserById.execute({ id: userId });
```

## Database Optimization

### Indexes

Declare indexes directly on your Drizzle table:

```typescript
import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  })
);
```

### Connection Timeout

Set appropriate timeouts for your environment:

```typescript
database: {
  connectionTimeout: 5_000,  // 5s for serverless
  // connectionTimeout: 10_000, // 10s for long-running servers
}
```

## Monitoring Performance

### Metrics Endpoint

Enable metrics collection:

```typescript
observability: {
  metrics: { enabled: true, endpoint: "/metrics" },
}
```

Available metrics:

| Metric                          | Type      | Description                      |
| ------------------------------- | --------- | -------------------------------- |
| `http_requests_total`           | Counter   | Requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Response time percentiles        |
| `db_queries_total`              | Counter   | Queries by operation type        |
| `db_query_duration_seconds`     | Histogram | Query time percentiles           |
| `cache_hits_total`              | Counter   | Cache hits                       |
| `cache_misses_total`            | Counter   | Cache misses                     |

### Distributed Tracing

```typescript
observability: {
  tracing: { enabled: true, sampleRate: 0.1 },
}
```

Traces show the full request lifecycle:

```
Request Trace
├── HTTP Request (2ms)
│   ├── Authentication (1ms)
│   ├── Validation (0.5ms)
│   ├── Route Handler (15ms)
│   │   ├── Database Query (10ms)
│   │   └── Cache Lookup (0.2ms)
│   └── Serialization (0.3ms)
```
