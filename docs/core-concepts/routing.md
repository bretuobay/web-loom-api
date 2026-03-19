# Routing Guide

Web Loom API supports two routing approaches: **file-based routing** (auto-discovery from `src/routes/`) and **CRUD generation** from models. Both work together — CRUD routes are mounted first and hand-written routes can override them.

## File-Based Routing

Route files in `src/routes/` (configurable via `routes.dir`) are discovered automatically at startup. Each file must export a Hono app instance as its **default export**.

| File Path                     | Mount Path       |
| ----------------------------- | ---------------- |
| `src/routes/users.ts`         | `/users`         |
| `src/routes/users/[id].ts`    | `/users/:id`     |
| `src/routes/api/v1/health.ts` | `/api/v1/health` |
| `src/routes/index.ts`         | `/`              |

## `defineRoutes()`

`defineRoutes()` returns a `Hono<{ Variables: WebLoomVariables }>` instance with `c.var.db` and `c.var.email` pre-typed. Use it as the default export of every route file:

```typescript
// src/routes/users.ts
import { defineRoutes } from '@web-loom/api-core';
import { usersTable } from '../schema';
import { eq } from 'drizzle-orm';

const app = defineRoutes();

app.get('/', async (c) => {
  const users = await c.var.db.select().from(usersTable);
  return c.json({ users });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [user] = await c.var.db.select().from(usersTable).where(eq(usersTable.id, id));

  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  return c.json({ user });
});

export default app;
```

## Dynamic Segments

Use `[param]` in directory or file names for dynamic URL segments:

```
src/routes/users/[id].ts        →  /users/:id
src/routes/posts/[id]/comments  →  /posts/:id/comments
```

## `validate()` — Request Validation

`validate(target, schema)` wraps `@hono/zod-validator` and formats errors as the standard `VALIDATION_ERROR` shape.

```typescript
import { defineRoutes, validate } from '@web-loom/api-core';
import { z } from 'zod';

const app = defineRoutes();

app.post(
  '/',
  validate(
    'json',
    z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
    })
  ),
  async (c) => {
    const data = c.req.valid('json'); // typed
    // ...
  }
);

// Validate query params
app.get(
  '/search',
  validate(
    'query',
    z.object({
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(20),
    })
  ),
  async (c) => {
    const { q, limit } = c.req.valid('query');
    // ...
  }
);
```

Validation targets: `"json"` | `"query"` | `"param"` | `"form"` | `"header"`

### Validation Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-01-15T10:30:45.123Z",
    "details": {
      "fields": [
        { "path": ["email"], "message": "Invalid email", "code": "invalid_string" },
        { "path": ["name"], "message": "Required", "code": "invalid_type" }
      ]
    }
  }
}
```

## Request Context (`c`)

Every handler receives Hono's context object `c`:

```typescript
app.get('/:id', async (c) => {
  // URL params
  c.req.param('id'); // string | undefined
  c.req.param(); // Record<string, string>

  // Query string
  c.req.query('page'); // string | undefined
  c.req.queries('tags'); // string[] | undefined

  // Headers
  c.req.header('Authorization'); // string | undefined

  // Validated data (only after validate() middleware)
  c.req.valid('json'); // typed validated body
  c.req.valid('query'); // typed validated query

  // Injected by Web Loom
  c.var.db; // AnyDrizzleDB — Drizzle instance
  c.var.email; // EmailAdapter | undefined
  c.var.user; // AuthUser | undefined (set by auth middleware)

  // Response helpers
  return c.json({ data }); // 200 JSON
  return c.json({ data }, 201); // 201 JSON
  return c.text('ok'); // 200 text
  return c.body(null, 204); // 204 No Content
});
```

## Middleware

### Route-Level Middleware

```typescript
import { jwtAuth, requireRole } from '@web-loom/api-middleware-auth';

const app = defineRoutes();

// Apply middleware to all routes in this file
app.use('/*', jwtAuth({ secret: process.env.JWT_SECRET! }));

// Apply to a specific route
app.delete('/:id', requireRole('admin'), async (c) => {
  // Only admins reach here
});
```

### Global Middleware

Register in `src/index.ts` via `app.hono`:

```typescript
const app = await createApp(config);
app.hono.use('/*', myGlobalMiddleware);
```

## OpenAPI Annotations

Use `openApiMeta()` to add OpenAPI metadata to hand-written routes. The middleware has no effect at request time — it only attaches metadata for documentation generation.

```typescript
import { defineRoutes, validate, openApiMeta } from '@web-loom/api-core';
import { z } from 'zod';

const app = defineRoutes();

app.post(
  '/send-invite',
  openApiMeta({
    summary: 'Send an invitation email',
    tags: ['invites'],
    operationId: 'sendInvite',
    request: {
      body: z.object({ email: z.string().email() }),
    },
    responses: {
      204: { description: 'Invitation sent' },
      422: { description: 'Invalid email address' },
    },
  }),
  validate('json', z.object({ email: z.string().email() })),
  async (c) => {
    const { email } = c.req.valid('json');
    await c.var.email?.send({ to: email, subject: "You're invited!" });
    return c.body(null, 204);
  }
);

export default app;
```

## CRUD Routes

When a model has `crud: true` or `crud: { ... }`, these routes are auto-generated and mounted before file-based routes:

```
GET    /users          → List (paginated, filterable, sortable)
POST   /users          → Create
GET    /users/:id      → Read by ID
PUT    /users/:id      → Replace (full body required)
PATCH  /users/:id      → Partial update
DELETE /users/:id      → Delete (or soft-delete)
```

### List Query Parameters

| Param       | Description                                 | Example                    |
| ----------- | ------------------------------------------- | -------------------------- |
| `page`      | Page number (default: 1)                    | `?page=2`                  |
| `limit`     | Items per page (default: 20, max: 100)      | `?limit=50`                |
| `sort`      | Field to sort by; prefix `-` for descending | `?sort=-createdAt,name`    |
| `fields`    | Comma-separated fields to return            | `?fields=id,name,email`    |
| `search`    | Full-text search (LIKE on string columns)   | `?search=alice`            |
| `field[op]` | Operator filtering                          | `?age[gte]=18&age[lte]=65` |

Operator suffixes: `[gte]`, `[lte]`, `[like]`, `[in]`

### Paginated Response

```json
{
  "data": [ ... ],
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

| Status | Code               | When                              |
| ------ | ------------------ | --------------------------------- |
| 400    | `VALIDATION_ERROR` | Invalid request data              |
| 401    | `UNAUTHORIZED`     | Missing or invalid credentials    |
| 403    | `FORBIDDEN`        | Insufficient permissions          |
| 404    | `NOT_FOUND`        | Resource not found                |
| 409    | `CONFLICT`         | Unique constraint or FK violation |
| 500    | `INTERNAL_ERROR`   | Unhandled server error            |

## Route Conflicts

If two route files map to the same path prefix, a `RouteConflictError` is thrown at startup. File-based routes that overlap with CRUD routes emit a warning; the hand-written route wins.
