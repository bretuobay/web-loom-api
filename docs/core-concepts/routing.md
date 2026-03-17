# Routing Guide

Web Loom API supports two routing approaches: **file-based routing** (automatic discovery from `src/routes/`) and **programmatic routing** with `defineRoutes()`. Both can be used together.

## File-Based Routing

Route files in `src/routes/` are automatically discovered and mapped to URL paths:

| File Path | URL Path |
|-----------|----------|
| `src/routes/users.ts` | `/users` |
| `src/routes/users/[id].ts` | `/users/:id` |
| `src/routes/posts/[...slug].ts` | `/posts/*` (catch-all) |
| `src/routes/api/v1/health.ts` | `/api/v1/health` |

### Dynamic Segments

Use `[param]` in filenames for dynamic URL segments:

```
src/routes/users/[id].ts  →  /users/:id
```

Access the parameter in your handler:

```typescript
router.get("/users/:id", {
  handler: async (ctx) => {
    const userId = ctx.params.id;
    // ...
  },
});
```

### Catch-All Routes

Use `[...param]` for catch-all segments:

```
src/routes/docs/[...path].ts  →  /docs/*
```

### Route Conflicts

If two files map to the same URL path and HTTP method, the Core Runtime terminates with a conflict error at startup.

## Programmatic Routing with `defineRoutes()`

Define routes explicitly using the `defineRoutes()` function:

```typescript
import { defineRoutes } from "@web-loom/api-core";

export default defineRoutes((router) => {
  router.get("/api/health", {
    handler: async (ctx) => {
      return ctx.json({ status: "ok" });
    },
  });

  router.post("/api/users", {
    handler: async (ctx) => {
      // ...
    },
  });
});
```

### HTTP Methods

```typescript
router.get(path, options);     // GET
router.post(path, options);    // POST
router.put(path, options);     // PUT
router.patch(path, options);   // PATCH
router.delete(path, options);  // DELETE
router.options(path, options); // OPTIONS
```

### Route Options

```typescript
router.post("/api/posts", {
  // Request validation
  validation: {
    body: Post.schema.pick("title", "content", "status"),
    query: { page: { type: "number", min: 1 } },
    params: { id: { type: "uuid" } },
  },

  // Middleware (runs before handler)
  middleware: [authenticate, adminOnly],

  // Response caching
  cache: { ttl: 60, tags: ["posts"] },

  // Auth requirement
  auth: true,           // or "admin", "owner", false

  // Rate limit override
  rateLimit: { windowMs: 60_000, max: 10 },

  // Route metadata (used by OpenAPI generator)
  metadata: {
    description: "Create a new post",
    tags: ["posts"],
  },

  // The handler
  handler: async (ctx) => {
    // ...
  },
});
```

## Request Context

Every handler receives a `ctx` object with access to the request, adapters, and utilities:

```typescript
handler: async (ctx) => {
  // Request data
  ctx.params          // URL parameters (e.g., { id: "abc" })
  ctx.query           // Query string parameters
  ctx.body            // Parsed and validated request body
  ctx.request         // Raw Request object

  // Adapters
  ctx.db              // Database adapter (query builder)
  ctx.auth            // Auth adapter (sessions, passwords)
  ctx.email           // Email adapter

  // Utilities
  ctx.json(data, status?)     // Return JSON response
  ctx.setCookie(name, value)  // Set a cookie
  ctx.deleteCookie(name)      // Delete a cookie

  // Auth context (when authenticated)
  ctx.user            // Current user
  ctx.session         // Current session

  // Advanced
  ctx.cache           // Cache adapter
  ctx.webhooks        // Webhook dispatcher
  ctx.jobs            // Background job queue
}
```

## Request Validation

Validation schemas are defined inline or derived from models:

### Inline Validation

```typescript
router.post("/api/items", {
  validation: {
    body: {
      name: { type: "string", required: true, minLength: 1 },
      price: { type: "number", required: true, min: 0 },
      tags: { type: "array", items: { type: "string" } },
    },
  },
  handler: async (ctx) => {
    // ctx.body is typed as { name: string; price: number; tags?: string[] }
  },
});
```

### Model-Based Validation

```typescript
router.post("/api/users", {
  validation: {
    body: User.schema.pick("name", "email", "password"),
  },
  handler: async (ctx) => {
    // ctx.body is typed as { name: string; email: string; password: string }
  },
});
```

### Validation Errors

Invalid requests return HTTP 400 with structured errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": [
        { "path": ["email"], "message": "Invalid email format", "code": "invalid_format" },
        { "path": ["name"], "message": "Required", "code": "required" }
      ]
    }
  }
}
```

## Middleware

### Route-Level Middleware

```typescript
import { authenticate, adminOnly } from "../middleware/auth";

router.get("/api/admin/users", {
  middleware: [authenticate, adminOnly],
  handler: async (ctx) => {
    // Only authenticated admins reach this handler
  },
});
```

### Writing Custom Middleware

```typescript
import { Middleware } from "@web-loom/api-core";

export const logRequest: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.request.method} ${ctx.request.url}`);

  await next();

  console.log(`← ${Date.now() - start}ms`);
};
```

### Global Middleware

Register middleware that runs on every request:

```typescript
const app = await createApp(config);
app.use(logRequest);
app.use(corsMiddleware);
```

### Execution Order

1. Global middleware (in registration order)
2. Route-specific middleware (in array order)
3. Route handler
4. Response middleware (reverse order)

A middleware can short-circuit the chain by returning a response without calling `next()`:

```typescript
const requireApiKey: Middleware = async (ctx, next) => {
  const key = ctx.request.headers.get("X-API-Key");
  if (!key) {
    return ctx.json({ error: "API key required" }, 401);
  }
  await next();
};
```

## Query Builder

The `ctx.db` object provides a type-safe query builder:

```typescript
// Select with conditions
const users = await ctx.db
  .select(User)
  .where("role", "=", "admin")
  .orderBy("createdAt", "desc")
  .limit(20);

// Select with relationships
const post = await ctx.db
  .select(Post)
  .where("id", "=", ctx.params.id)
  .with("author")
  .with("comments")
  .first();

// Insert
const user = await ctx.db.insert(User, {
  name: "Alice",
  email: "alice@example.com",
});

// Update
const updated = await ctx.db.update(User, userId, { name: "Bob" });

// Delete
await ctx.db.delete(User, userId);

// Transactions
const result = await ctx.db.transaction(async (tx) => {
  const user = await tx.insert(User, userData);
  const post = await tx.insert(Post, { ...postData, userId: user.id });
  return { user, post };
});
```

## CRUD Routes

When a model has `crud: true`, these routes are auto-generated:

```
POST   /users          → Create
GET    /users          → List (paginated)
GET    /users/:id      → Get by ID
PUT    /users/:id      → Full update
PATCH  /users/:id      → Partial update
DELETE /users/:id      → Delete
```

### Pagination

```bash
# Page-based
GET /users?page=2&limit=20

# Cursor-based
GET /users?cursor=abc123&limit=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

### Filtering and Sorting

```bash
# Filter by field
GET /users?status=active

# Comparison operators
GET /users?age[gte]=18&age[lte]=65

# Sort (prefix with - for descending)
GET /users?sort=-createdAt,name

# Field selection
GET /users?fields=id,name,email

# Include relationships
GET /users?include=posts,comments

# Search
GET /users?search=alice
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "timestamp": "2025-01-15T10:30:45.123Z",
    "requestId": "req_abc123"
  }
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid request data |
| 401 | `UNAUTHORIZED` | Missing or invalid auth |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource or route not found |
| 409 | `CONFLICT` | Version mismatch or unique constraint |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error |
