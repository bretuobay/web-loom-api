# @web-loom/api

A modular REST API framework for building serverless APIs on top of [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and [Zod](https://zod.dev).

Write once, deploy anywhere — Vercel Edge, Cloudflare Workers, AWS Lambda, or Docker.

## Why Web Loom API?

- **Serverless-first** — optimized for cold starts and edge deployment
- **Model-driven** — define a Drizzle table once, get CRUD routes, OpenAPI specs, and typed clients automatically
- **No magic adapters** — Hono, Drizzle, and Zod are first-class; you write real Drizzle queries in route handlers
- **Platform-agnostic** — deploy to Vercel, Cloudflare, AWS Lambda, or Docker from the same codebase
- **OpenAPI built-in** — live `/openapi.json`, `/openapi.yaml`, and `/docs` (Swagger or Scalar)

## Quick Start

```bash
npm install @web-loom/api-core drizzle-orm
```

```typescript
// webloom.config.ts
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless', // or "libsql" | "pg"
  },
  routes: { dir: './src/routes' },
  openapi: { enabled: true, title: 'My API', version: '1.0.0' },
});
```

```typescript
// src/schema.ts — your Drizzle table is the single source of truth
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Registers the model; auto-generates 6 CRUD routes at /users
export const User = defineModel(usersTable, {
  name: 'User',
  crud: true,
});
```

```typescript
// src/routes/users.ts — hand-written routes alongside generated CRUD
import { defineRoutes, validate } from '@web-loom/api-core';
import { z } from 'zod';
import { usersTable } from '../schema';

const app = defineRoutes();

// GET /users/search?q=...
app.get('/search', async (c) => {
  const q = c.req.query('q') ?? '';
  const users = await c.var.db
    .select()
    .from(usersTable)
    .where(like(usersTable.name, `%${q}%`));
  return c.json({ users });
});

export default app;
```

```typescript
// src/index.ts
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';
import './src/schema'; // import models so they register

const app = await createApp(config);
await app.start(3000);
```

## Packages

### Core

| Package                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `@web-loom/api-core`   | Core runtime, model registry, route discovery, configuration |
| `@web-loom/api-shared` | Shared types and utilities                                   |
| `@web-loom/api-cli`    | CLI for code generation and scaffolding (`webloom` command)  |

### Generators

| Package                           | Description                                            |
| --------------------------------- | ------------------------------------------------------ |
| `@web-loom/api-generator-crud`    | Automatic CRUD route generation from model definitions |
| `@web-loom/api-generator-openapi` | OpenAPI 3.1 document generation + Swagger/Scalar UI    |

### Middleware

| Package                         | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `@web-loom/api-middleware-auth` | JWT, session, and API key auth; RBAC guards; CSRF protection |

### Deployment

| Package                               | Description                    |
| ------------------------------------- | ------------------------------ |
| `@web-loom/api-deployment-vercel`     | Vercel Edge/Serverless handler |
| `@web-loom/api-deployment-cloudflare` | Cloudflare Workers handler     |
| `@web-loom/api-deployment-aws`        | AWS Lambda handler             |

## Deploy Anywhere

```typescript
// Node.js / Docker
const app = await createApp(config);
await app.start(3000);

// Vercel Edge / Cloudflare Workers / AWS Lambda
export default { fetch: (req: Request) => app.handleRequest(req) };
```

Or use the deployment packages which set up the entry point for you:

```typescript
// Cloudflare Workers (packages/api-deployment-cloudflare)
import { app } from './app';
export default { fetch: app.handleRequest.bind(app) };
```

## Authentication

```typescript
import { jwtAuth, apiKeyAuth, requireRole, composeAuth } from "@web-loom/api-middleware-auth";

const app = defineRoutes();

// Protect all routes with JWT
app.use("/*", jwtAuth({ secret: process.env.JWT_SECRET! }));

// Restrict an endpoint to admins
app.delete("/:id", requireRole("admin"), async (c) => { ... });

// Accept JWT or API key on the same route
app.use("/*", composeAuth(
  jwtAuth({ secret: process.env.JWT_SECRET! }),
  apiKeyAuth({ validate: async (key) => lookupApiKey(key) }),
));
```

## OpenAPI

```typescript
import { openApiMeta } from "@web-loom/api-core";

// Annotate hand-written routes for OpenAPI docs
app.post(
  "/send-invite",
  openApiMeta({
    summary: "Send an invitation email",
    tags: ["invites"],
    operationId: "sendInvite",
    request: { body: z.object({ email: z.string().email() }) },
    responses: { 204: { description: "Sent" } },
  }),
  async (c) => { ... }
);
```

Live endpoints (when `openapi.enabled: true`):

- `GET /openapi.json` — OpenAPI 3.1 spec
- `GET /openapi.yaml` — YAML version
- `GET /docs` — Swagger UI or Scalar

Generate a static file or typed client with the CLI:

```bash
npx webloom generate openapi --output ./openapi.json
npx webloom generate client --input ./openapi.json --output ./src/client
```

## Project Structure

```
packages/
  api-core/              # Core runtime and registries
  api-shared/            # Shared types
  api-cli/               # CLI tools
  api-middleware/
    auth/                # JWT, session, API key auth; RBAC; CSRF
  api-generators/
    crud/                # CRUD route generation
    openapi/             # OpenAPI document generation
  api-deployment/
    vercel/              # Vercel deployment adapter
    cloudflare/          # Cloudflare Workers deployment adapter
    aws/                 # AWS Lambda deployment adapter
examples/
  minimal/               # Simple CRUD API
  full-stack/            # Full-featured app
  serverless/            # Multi-platform deployment
docs/                    # Documentation
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npx turbo run build

# Run all tests
npx turbo run test

# Type check
npx turbo run check-types

# Lint
npx turbo run lint
```

## Documentation

See the [docs/](./docs/) directory:

- [Getting Started](./docs/getting-started.md)
- [Core Concepts](./docs/core-concepts/) — stack overview, models, configuration, routing
- [API Reference](./docs/api-reference/) — full API documentation
- [Deployment Guides](./docs/deployment/) — Vercel, Cloudflare, AWS, Docker

## License

MIT
