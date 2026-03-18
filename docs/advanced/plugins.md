# Extending Web Loom API

Web Loom API does not have a formal plugin system. Extension happens through the standard mechanisms the framework is built on: Hono middleware, route files, and `defineModel()`. This guide shows the common patterns.

## Global Middleware

Register middleware that runs on every request via `app.hono` after `createApp()`:

```typescript
// src/index.ts
import { createApp } from "@web-loom/api-core";
import type { MiddlewareHandler } from "hono";
import config from "../webloom.config";
import "./schema";

const app = await createApp(config);

// Request timing
const requestTimer: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  c.res.headers.set("X-Response-Time", `${Date.now() - start}ms`);
};

// Apply globally
app.hono.use("/*", requestTimer);

await app.start(3000);
```

For reuse across projects, package middleware as a plain function and import it:

```typescript
// packages/timing-middleware/src/index.ts
import type { MiddlewareHandler } from "hono";

export function timingMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    c.res.headers.set("X-Response-Time", `${Date.now() - start}ms`);
  };
}
```

## Adding Routes

Drop a file into `src/routes/` — it's discovered and mounted automatically at the matching path.

For routes that need to be shared across projects, export the Hono app and mount it manually:

```typescript
// packages/health-routes/src/index.ts
import { Hono } from "hono";

export function createHealthRoutes(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/ready", (c) => c.json({ status: "ready" }));

  return app;
}
```

```typescript
// src/index.ts
import { createHealthRoutes } from "@myorg/health-routes";

const app = await createApp(config);
app.hono.route("/", createHealthRoutes());
```

## Adding Models

Call `defineModel()` anywhere before `createApp()`. Models register themselves in the global `ModelRegistry` on import.

```typescript
// src/schema/audit-log.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { defineModel } from "@web-loom/api-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// No CRUD routes — just a registry entry for the OpenAPI generator
export const AuditLog = defineModel(auditLogsTable, {
  name: "AuditLog",
  crud: false,
});
```

```typescript
// src/index.ts
import "./schema/audit-log"; // import to register
```

## Audit Logging Pattern

A common "plugin-like" pattern: a self-contained module that exports a middleware and a model:

```typescript
// src/audit/index.ts
import { defineRoutes } from "@web-loom/api-core";
import { auditLogsTable } from "./schema";
import type { MiddlewareHandler } from "hono";

export const auditMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  const method = c.req.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    await c.var.db.insert(auditLogsTable).values({
      userId: c.var.user?.id ?? null,
      action: method,
      resource: new URL(c.req.url).pathname,
    });
  }
};
```

```typescript
// src/index.ts
import { auditMiddleware } from "./audit";

const app = await createApp(config);
app.hono.use("/api/*", auditMiddleware);
```

## Lifecycle Hooks

There is no formal lifecycle hook system. Use standard Node.js process events for shutdown handling:

```typescript
const app = await createApp(config);
await app.start(3000);

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await app.shutdown(10_000);
  process.exit(0);
});

process.on("SIGINT", async () => {
  await app.shutdown(5_000);
  process.exit(0);
});
```

`app.shutdown()` waits for in-flight requests to complete and closes the database connection.

## Auth Extension

Extend authentication by composing strategies from `@web-loom/api-middleware-auth`:

```typescript
import {
  jwtAuth,
  apiKeyAuth,
  composeAuth,
  requireRole,
} from "@web-loom/api-middleware-auth";

// Custom API key lookup
const apiKeyStrategy = apiKeyAuth({
  validate: async (key) => {
    const [record] = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.hash, hashKey(key)));
    if (!record) return null;
    return { id: record.userId, role: record.role };
  },
});

// Accept either JWT or API key
const multiAuth = composeAuth(
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  apiKeyStrategy,
);

// Apply globally
app.hono.use("/api/*", multiAuth);

// Restrict a specific path to admins
app.hono.use("/api/admin/*", multiAuth, requireRole("admin"));
```

## Packaging Reusable Extensions

Structure a reusable extension as a plain TypeScript package:

```
packages/my-extension/
  src/
    middleware.ts   # MiddlewareHandler exports
    routes.ts       # Hono app factory
    schema.ts       # defineModel() calls (imported for side effects)
    index.ts        # re-exports
  package.json      # peerDependencies: { "@web-loom/api-core": "^1" }
```

```typescript
// packages/my-extension/src/index.ts
export { myMiddleware } from "./middleware";
export { createMyRoutes } from "./routes";
export "./schema"; // register models as a side effect on import
```

Consumer usage:

```typescript
import { myMiddleware, createMyRoutes } from "@myorg/my-extension";
import "@myorg/my-extension/schema"; // or import the package to trigger model registration

const app = await createApp(config);
app.hono.use("/*", myMiddleware);
app.hono.route("/extension", createMyRoutes());
```
