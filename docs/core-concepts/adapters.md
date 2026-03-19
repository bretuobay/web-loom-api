# Stack Overview

Web Loom API is built directly on [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and [Zod](https://zod.dev). These are not hidden behind adapter interfaces — you write real Drizzle queries and real Hono handlers. The framework adds model registration, file-based route discovery, CRUD generation, and OpenAPI documentation on top.

```
┌────────────────────────────────────────────────┐
│                 Your Application               │
│       models  ·  routes  ·  middleware         │
├────────────────────────────────────────────────┤
│               Web Loom API Core                │
│  createApp · defineModel · defineRoutes        │
│  validate  · openApiMeta · ModelRegistry       │
├────────────────────────────────────────────────┤
│  Hono (HTTP)  │  Drizzle ORM  │  Zod (schemas) │
├────────────────────────────────────────────────┤
│     neon-serverless  │  libsql  │  pg           │
└────────────────────────────────────────────────┘
```

## HTTP — Hono

[Hono](https://hono.dev) is the HTTP layer. `defineRoutes()` returns a `Hono<{ Variables: WebLoomVariables }>` instance, giving full access to Hono's API.

```typescript
import { defineRoutes } from '@web-loom/api-core';

const app = defineRoutes();

// Standard Hono handler
app.get('/hello', (c) => c.text('Hello!'));

// Access Drizzle via c.var.db
app.get('/users', async (c) => {
  const users = await c.var.db.select().from(usersTable);
  return c.json({ users });
});
```

Web Loom's `Application` wraps Hono. Reach the underlying instance via `app.hono`:

```typescript
const app = await createApp(config);
app.hono.use('/*', myMiddleware); // register global middleware
```

## Database — Drizzle ORM

[Drizzle ORM](https://orm.drizzle.team) is the database layer. Three drivers are supported:

| Driver            | Connection type                      | Install                    |
| ----------------- | ------------------------------------ | -------------------------- |
| `neon-serverless` | Neon Postgres over HTTP (edge-safe)  | `@neondatabase/serverless` |
| `libsql`          | Turso / local SQLite via libsql      | `@libsql/client`           |
| `pg`              | Standard node-postgres (Docker, VMs) | `pg`                       |

Configure via `defineConfig()`:

```typescript
defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
  },
});
```

In route handlers, `c.var.db` is the Drizzle instance. Cast it to your driver type for full inference:

```typescript
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

app.get('/users', async (c) => {
  const db = c.var.db as NeonDatabase<typeof schema>;
  const users = await db.select().from(schema.usersTable);
  return c.json({ users });
});
```

## Validation — Zod + drizzle-zod

[Zod](https://zod.dev) is used for all request validation. `defineModel()` generates Zod schemas automatically from Drizzle tables using [drizzle-zod](https://orm.drizzle.team/docs/zod). Use `validate()` to attach them to routes:

```typescript
import { validate } from '@web-loom/api-core';
import { User } from './schema';

app.post('/', validate('json', User.insertSchema), async (c) => {
  const data = c.req.valid('json'); // fully typed
  // ...
});
```

You can also use Zod schemas directly without a model:

```typescript
import { z } from 'zod';

app.post('/subscribe', validate('json', z.object({ email: z.string().email() })), async (c) => {
  const { email } = c.req.valid('json');
  // ...
});
```

## Authentication — `@web-loom/api-middleware-auth`

Authentication is provided by the `@web-loom/api-middleware-auth` package. It integrates with Hono's middleware system — no adapter required.

Three strategies are available out of the box:

```typescript
import {
  jwtAuth,
  sessionAuth,
  apiKeyAuth,
  requireRole,
  requirePermission,
  composeAuth,
  csrfProtection,
} from '@web-loom/api-middleware-auth';
```

See the [Auth Middleware reference](../api-reference/middleware.md) for full documentation.

## Email

Email is optional. Pass an `EmailAdapter` implementation to `defineConfig()`:

```typescript
import { defineConfig } from '@web-loom/api-core';
import { ResendAdapter } from '@web-loom/api-shared';

export default defineConfig({
  database: { url: '...', driver: 'neon-serverless' },
  email: new ResendAdapter({
    apiKey: process.env.RESEND_API_KEY!,
    from: 'noreply@example.com',
  }),
});
```

In route handlers, access via `c.var.email`:

```typescript
app.post('/contact', async (c) => {
  await c.var.email!.send({
    to: 'support@example.com',
    subject: 'New contact form submission',
    html: '<p>Hello</p>',
  });
  return c.body(null, 204);
});
```

Accessing `c.var.email` when no adapter is configured throws a `ConfigurationError`.

## OpenAPI — `@web-loom/api-generator-openapi`

OpenAPI document generation is automatic. When `openapi.enabled: true`, the framework:

1. Reads all registered models and generates path items for CRUD operations
2. Reads `openApiMeta()` annotations from route handlers
3. Combines them into a valid OpenAPI 3.1 document

Live endpoints:

- `GET /openapi.json`
- `GET /openapi.yaml`
- `GET /docs` (Swagger UI or Scalar)

Generate static files with the CLI:

```bash
npx webloom generate openapi --output ./openapi.json
npx webloom generate client --input ./openapi.json --output ./src/client
```
