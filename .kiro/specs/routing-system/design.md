# Design: Routing System

## Overview

Routes are Hono routers. File-based discovery imports route files and mounts them. `defineRoutes()` returns a typed `Hono` instance. Validation uses `@hono/zod-validator` directly.

```
src/routes/
  users.ts        → export default defineRoutes()  (mounts at /users)
  users/[id].ts   → export default defineRoutes()  (mounts at /users/:id)
  posts.ts        → export default defineRoutes()  (mounts at /posts)

          ▼  Route Discovery (startup)

  Main Hono App
    ├── Global middleware (db injector, logger, compress)
    ├── Health routes (/health, /ready)
    ├── CRUD-generated routes (mounted first)
    ├── /users       ← users.ts router
    ├── /users/:id   ← users/[id].ts router
    └── /posts       ← posts.ts router
```

## defineRoutes()

```typescript
// packages/api-core/src/routing/define-routes.ts

import { Hono } from 'hono';
import type { WebLoomVariables } from '../types';

/**
 * Returns a typed Hono router pre-bound to WebLoomVariables.
 * Use this as the return value of every route file's default export.
 */
export function defineRoutes() {
  return new Hono<{ Variables: WebLoomVariables }>();
}
```

## Route File Pattern

```typescript
// src/routes/users.ts
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { defineRoutes } from '@web-loom/api-core';
import { User, usersTable } from '../models/user';

const app = defineRoutes();

app.get('/', async (c) => {
  const users = await c.var.db.select().from(usersTable);
  return c.json({ users });
});

app.post('/',
  zValidator('json', User.insertSchema),
  async (c) => {
    const data = c.req.valid('json');  // fully typed
    const [user] = await c.var.db.insert(usersTable).values(data).returning();
    return c.json({ user }, 201);
  }
);

export default app;
```

## Route Discovery

```typescript
// packages/api-core/src/routing/route-discovery.ts

import { Hono } from 'hono';
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { WebLoomVariables } from '../types';

export async function discoverAndMountRoutes(
  mainApp: Hono<{ Variables: WebLoomVariables }>,
  routesDir: string
): Promise<void> {
  const files = await collectRouteFiles(routesDir);

  for (const filePath of files) {
    const module = await import(filePath);
    const router: unknown = module.default;

    if (!(router instanceof Hono)) {
      throw new RouteLoadError(filePath, 'default export must be a Hono instance from defineRoutes()');
    }

    const mountPath = filePathToMountPath(filePath, routesDir);
    mainApp.route(mountPath, router as Hono);
  }
}

/** Converts src/routes/users/[id].ts → /users/:id */
function filePathToMountPath(filePath: string, baseDir: string): string {
  const rel = relative(baseDir, filePath)
    .replace(/\.ts$/, '')           // remove extension
    .replace(/\/index$/, '')        // index.ts → /
    .replace(/\[\.\.\.(\w+)\]/g, '*')   // [...slug] → *
    .replace(/\[(\w+)\]/g, ':$1');  // [id] → :id

  return '/' + rel || '/';
}
```

## Path Convention Table

| File | Mount Path | Note |
|---|---|---|
| `routes/users.ts` | `/users` | flat |
| `routes/users/index.ts` | `/users` | directory index |
| `routes/users/[id].ts` | `/users/:id` | dynamic segment |
| `routes/posts/[...slug].ts` | `/posts/*` | catch-all |
| `routes/api/v1/health.ts` | `/api/v1/health` | nested |

## Global Error Handler

```typescript
// packages/api-core/src/routing/error-handler.ts

import { randomUUID } from 'node:crypto';
import type { ErrorHandler } from 'hono';

export const globalErrorHandler: ErrorHandler = (err, c) => {
  const requestId = randomUUID();
  const path = new URL(c.req.url).pathname;

  // Known application errors
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: 'NOT_FOUND', message: err.message, requestId, path, timestamp: new Date().toISOString() } }, 404);
  }
  if (err instanceof ConflictError) {
    return c.json({ error: { code: 'CONFLICT', message: err.message, requestId, path, timestamp: new Date().toISOString() } }, 409);
  }

  // Unknown errors — hide details in production
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  console.error(`[${requestId}]`, err);

  return c.json({ error: { code: 'INTERNAL_ERROR', message, requestId, path, timestamp: new Date().toISOString() } }, 500);
};
```

## Validation Error Formatting

Hono's `zValidator` accepts a custom error hook:

```typescript
// packages/api-core/src/routing/validation-hook.ts

import type { ValidationTargets } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

/** Wrapper around zValidator that formats errors into the standard shape */
export function validate<T extends keyof ValidationTargets>(
  target: T,
  schema: ZodSchema
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const requestId = crypto.randomUUID();
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          requestId,
          timestamp: new Date().toISOString(),
          details: {
            fields: result.error.issues.map((issue) => ({
              path: issue.path.map(String),
              message: issue.message,
              code: issue.code,
            })),
          },
        },
      }, 400);
    }
  });
}
```

Usage in route files:
```typescript
import { validate } from '@web-loom/api-core';

app.post('/', validate('json', User.insertSchema), async (c) => {
  const data = c.req.valid('json'); // typed
  // ...
});
```
