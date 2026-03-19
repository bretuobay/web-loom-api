# @web-loom/api-core

Core runtime for [Web Loom API](https://github.com/bretuobay/web-loom-api) — a modular REST API framework built on [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and [Zod](https://zod.dev).

## Installation

```bash
npm install @web-loom/api-core drizzle-orm hono zod
```

Install the peer dependency for your database driver:

```bash
# PostgreSQL (Node.js)
npm install pg

# Neon serverless (edge/Workers)
npm install @neondatabase/serverless

# LibSQL / Turso (SQLite)
npm install @libsql/client
```

## Quick Start

```typescript
// webloom.config.ts
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'pg', // 'pg' | 'neon-serverless' | 'libsql'
  },
  routes: { dir: './src/routes' },
  openapi: { enabled: true, title: 'My API', version: '1.0.0' },
});
```

```typescript
// src/schema.ts — Drizzle table is the single source of truth
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Registers the model; auto-generates CRUD routes at /users
export const UserModel = defineModel(usersTable, {
  name: 'User',
  basePath: '/users',
  crud: {
    list: { auth: false },
    create: { auth: false },
    read: { auth: false },
    update: { auth: true },
    delete: { auth: true },
  },
});

export type User = typeof usersTable.$inferSelect;
```

```typescript
// src/routes/users.ts — hand-written routes alongside generated CRUD
import { defineRoutes, validate } from '@web-loom/api-core';
import { jwtAuth } from '@web-loom/api-middleware-auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { usersTable } from '../schema';

const routes = defineRoutes();

routes.get('/users/search', async (c) => {
  const q = c.req.query('q') ?? '';
  const users = await c.var.db
    .select()
    .from(usersTable)
    .where(like(usersTable.name, `%${q}%`));
  return c.json({ users });
});

routes.delete('/users/:id', jwtAuth({ secret: process.env.JWT_SECRET! }), async (c) => {
  await c.var.db.delete(usersTable).where(eq(usersTable.id, c.req.param('id')));
  return c.json({ success: true });
});

export default routes;
```

```typescript
// src/index.ts
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';

const app = await createApp(config);
await app.start(3000);
```

## API Reference

### `defineConfig(config)`

Define the application configuration. Returns a typed `WebLoomConfig` object.

```typescript
defineConfig({
  database: {
    url: string,              // required
    driver: 'pg' | 'neon-serverless' | 'libsql',  // required
    poolSize?: number,        // pg only, default 10
    connectionTimeout?: number, // pg only, default 10000
    ssl?: boolean,            // pg only
  },
  routes?: {
    dir: string,              // directory to auto-discover route files
  },
  openapi?: {
    enabled: boolean,
    ui?: 'swagger' | 'scalar',
    title?: string,
    version?: string,
  },
  security?: {
    cors?: {
      origins: string[],      // note: plural array
      credentials?: boolean,
      methods?: string[],
    },
    rateLimit?: {
      window: '30s' | '1m' | '1h' | '1d',
      limit: number,
    },
  },
  features?: {
    crud?: boolean,           // enable auto-generated CRUD routes
    caching?: boolean,
    auditLogging?: boolean,
  },
  observability?: {
    logging?: { level: 'debug' | 'info' | 'warn' | 'error', format: 'json' | 'pretty' },
    metrics?: { enabled: boolean, endpoint?: string },
    tracing?: { enabled: boolean, sampleRate?: number },
  },
  development?: {
    hotReload?: boolean,
    apiDocs?: boolean,
    detailedErrors?: boolean,
  },
})
```

---

### `defineModel(table, meta, overrides?)`

Register a Drizzle table as a Web Loom model. Derives Zod schemas automatically via `drizzle-zod` and registers the model globally for CRUD generation.

```typescript
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';
import { z } from 'zod';

const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});

// Override the select schema to exclude sensitive fields
const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export const UserModel = defineModel(
  usersTable,
  {
    name: 'User',
    basePath: '/users',
    crud: {
      list: { auth: false },
      create: { auth: false },
      read: { auth: false },
      update: { auth: true },
      delete: { auth: true },
    },
  },
  { select: publicUserSchema } // optional schema overrides
);
```

**Returns** a `Model<TTable>` with:

- `table` — the Drizzle table
- `insertSchema` / `selectSchema` / `updateSchema` — Zod schemas
- `meta` — name, basePath, crud config

---

### `defineRoutes()`

Returns a typed `Hono` instance with `c.var.db` (and optionally `c.var.email`) pre-bound. Export the instance as the default export of any route file discovered by `config.routes.dir`.

```typescript
import { defineRoutes, validate } from '@web-loom/api-core';
import { z } from 'zod';

const routes = defineRoutes();

routes.post(
  '/items',
  validate('json', z.object({ name: z.string(), price: z.number() })),
  async (c) => {
    const { name, price } = c.req.valid('json'); // typed
    const [item] = await c.var.db.insert(itemsTable).values({ name, price }).returning();
    return c.json({ item }, 201);
  }
);

export default routes;
```

---

### `validate(target, schema)`

Validation middleware wrapping `@hono/zod-validator`. Formats Zod errors into the standard `VALIDATION_ERROR` response shape.

```typescript
import { validate } from '@web-loom/api-core';
import { z } from 'zod';

// Targets: 'json' | 'query' | 'param' | 'header' | 'form'
routes.post('/items', validate('json', z.object({ name: z.string() })), async (c) => {
  const { name } = c.req.valid('json');
  // ...
});
```

---

### `openApiMeta(meta)`

Annotate a route with OpenAPI metadata. Used alongside `defineRoutes()`.

```typescript
import { openApiMeta } from '@web-loom/api-core';

routes.post(
  '/send-invite',
  openApiMeta({
    summary: 'Send an invitation email',
    tags: ['invites'],
    operationId: 'sendInvite',
    request: { body: z.object({ email: z.string().email() }) },
    responses: { 204: { description: 'Sent' } },
  }),
  async (c) => {
    /* ... */
  }
);
```

---

### `createApp(config)`

Bootstrap the application. Connects the database, discovers route files, generates CRUD, mounts OpenAPI, and wires up middleware.

```typescript
const app = await createApp(config);

// Application interface:
app.hono          // underlying Hono instance
app.db            // Drizzle database instance
app.start(port?)  // start the HTTP server (Node.js only)
app.handleRequest(request: Request) // handle a Request manually (edge/serverless)
app.shutdown()    // graceful shutdown
app.getModelRegistry()
app.getRouteRegistry()
```

---

### Context variables (`c.var.*`)

Inside every route handler:

```typescript
c.var.db; // AnyDrizzleDB — Drizzle instance
c.var.email; // EmailAdapter | undefined — when config.email is set
c.var.user; // AuthUser | undefined — set by auth middleware (e.g. jwtAuth)
```

## OpenAPI Endpoints

When `openapi.enabled: true`:

| Route               | Description           |
| ------------------- | --------------------- |
| `GET /openapi.json` | OpenAPI 3.1 JSON spec |
| `GET /openapi.yaml` | OpenAPI 3.1 YAML spec |
| `GET /docs`         | Swagger UI or Scalar  |

## Peer Dependencies

| Package                    | Version | Required for                |
| -------------------------- | ------- | --------------------------- |
| `pg`                       | `^8`    | `driver: 'pg'`              |
| `@neondatabase/serverless` | `^0.10` | `driver: 'neon-serverless'` |
| `@libsql/client`           | `^0.14` | `driver: 'libsql'`          |
| `@hono/node-server`        | `^1`    | `app.start()` in Node.js    |

## License

MIT
