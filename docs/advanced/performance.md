# Performance Optimization

Strategies for minimizing cold starts, optimizing queries, and reducing bundle size.

## Cold Start Optimization

Serverless cold starts happen when a new instance is created. Web Loom targets < 100ms initialization.

### Lazy Email Loading

The email adapter is optional and initialized only when `c.var.email` is first accessed. Omitting it from config eliminates the import entirely from the cold start path:

```typescript
defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: "neon-serverless" },
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

### Serverless

Use `poolSize: 1` — each invocation gets one connection:

```typescript
database: {
  url: process.env.DATABASE_URL!,
  poolSize: 1,
  connectionTimeout: 5_000,
}
```

### Long-Running Servers

Use a larger pool:

```typescript
database: {
  url: process.env.DATABASE_URL!,
  poolSize: 10,
  connectionTimeout: 10_000,
}
```

### Read Replicas

Route read queries to replicas to distribute load:

```typescript
database: {
  url: process.env.DATABASE_URL!,
  poolSize: 10,
  readReplicas: [
    process.env.DATABASE_READ_URL_1!,
    process.env.DATABASE_READ_URL_2!,
  ],
}
```

## Response Caching

### Route-Level Caching

```typescript
router.get("/api/posts", {
  cache: { ttl: 60, tags: ["posts"] },
  handler: async (ctx) => {
    const posts = await ctx.db.select(Post).limit(20);
    return ctx.json({ posts });
  },
});
```

### Tag-Based Invalidation

Invalidate cached responses when data changes:

```typescript
router.post("/api/posts", {
  handler: async (ctx) => {
    const post = await ctx.db.insert(Post, ctx.body);
    await ctx.cache.invalidate(["posts"]); // Clear all post caches
    return ctx.json({ post }, 201);
  },
});
```

### Per-User Caching

When auth is enabled, caches are scoped per user automatically to prevent data leaks.

## Query Optimization

### Eager Loading

Avoid N+1 queries by eager-loading relationships:

```typescript
// Bad: N+1 queries
const posts = await ctx.db.select(Post).limit(20);
for (const post of posts) {
  post.author = await ctx.db.select(User).where("id", "=", post.userId).first();
}

// Good: Single query with JOIN
const posts = await ctx.db
  .select(Post)
  .with("author")
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

### Field Selection

Only fetch the fields you need:

```bash
GET /users?fields=id,name,email
```

### Prepared Statement Caching

Drizzle automatically caches prepared statements. Repeated queries reuse the compiled statement.

## Database Optimization

### Indexes

Add indexes to frequently queried fields:

```typescript
{
  name: "email",
  type: "string",
  database: { unique: true, index: true },
}
```

### Connection Timeout

Set appropriate timeouts:

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

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Response time percentiles |
| `db_queries_total` | Counter | Queries by operation type |
| `db_query_duration_seconds` | Histogram | Query time percentiles |
| `cache_hits_total` | Counter | Cache hits |
| `cache_misses_total` | Counter | Cache misses |

### Profiling

```bash
npx webloom profile
```

Generates a report with timing breakdowns for route handlers, validation, database queries, and serialization.

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
