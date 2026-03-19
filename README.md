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

All `@web-loom/*` packages are published to npm. `@repo/*` packages are internal monorepo tooling and are not published.

### Published to npm — install directly

#### Core

| Package                                               | npm                                                                                                         | Description                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@web-loom/api-core`](./packages/api-core/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-core)](https://www.npmjs.com/package/@web-loom/api-core) | Core runtime: `createApp`, `defineConfig`, `defineModel`, `defineRoutes`, `validate` |
| [`@web-loom/api-cli`](./packages/api-cli/README.md)   | [![npm](https://img.shields.io/npm/v/@web-loom/api-cli)](https://www.npmjs.com/package/@web-loom/api-cli)   | CLI tool: `webloom init`, `generate`, `migrate`, `dev`                               |

#### Middleware

| Package                                                                                 | npm                                                                                                                                           | Description                                                           |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@web-loom/api-middleware-auth`](./packages/api-middleware/auth/README.md)             | [![npm](https://img.shields.io/npm/v/@web-loom/api-middleware-auth)](https://www.npmjs.com/package/@web-loom/api-middleware-auth)             | JWT, session, API key auth; RBAC guards; CSRF protection              |
| [`@web-loom/api-middleware-cache`](./packages/api-middleware/cache/README.md)           | [![npm](https://img.shields.io/npm/v/@web-loom/api-middleware-cache)](https://www.npmjs.com/package/@web-loom/api-middleware-cache)           | Response caching with TTL, tag invalidation, in-memory/Redis backends |
| [`@web-loom/api-middleware-cors`](./packages/api-middleware/cors/README.md)             | [![npm](https://img.shields.io/npm/v/@web-loom/api-middleware-cors)](https://www.npmjs.com/package/@web-loom/api-middleware-cors)             | CORS preflight and response header middleware                         |
| [`@web-loom/api-middleware-rate-limit`](./packages/api-middleware/rate-limit/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-middleware-rate-limit)](https://www.npmjs.com/package/@web-loom/api-middleware-rate-limit) | Token-bucket rate limiting; per-IP, per-user, custom key strategies   |

#### Features

| Package                                                       | npm                                                                                                                 | Description                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@web-loom/api-jobs`](./packages/api-jobs/README.md)         | [![npm](https://img.shields.io/npm/v/@web-loom/api-jobs)](https://www.npmjs.com/package/@web-loom/api-jobs)         | Background job queues: priority, cron scheduling, exponential backoff |
| [`@web-loom/api-webhooks`](./packages/api-webhooks/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-webhooks)](https://www.npmjs.com/package/@web-loom/api-webhooks) | Webhook system with HMAC-SHA256 signed delivery and retry logic       |
| [`@web-loom/api-uploads`](./packages/api-uploads/README.md)   | [![npm](https://img.shields.io/npm/v/@web-loom/api-uploads)](https://www.npmjs.com/package/@web-loom/api-uploads)   | File upload handling; local, AWS S3, and Cloudflare R2 backends       |
| [`@web-loom/api-health`](./packages/api-health/README.md)     | [![npm](https://img.shields.io/npm/v/@web-loom/api-health)](https://www.npmjs.com/package/@web-loom/api-health)     | Liveness and readiness health check endpoints                         |
| [`@web-loom/api-plugins`](./packages/api-plugins/README.md)   | [![npm](https://img.shields.io/npm/v/@web-loom/api-plugins)](https://www.npmjs.com/package/@web-loom/api-plugins)   | Plugin system: register, discover, lifecycle-manage extensions        |

#### Observability

| Package                                                     | npm                                                                                                               | Description                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@web-loom/api-logging`](./packages/api-logging/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-logging)](https://www.npmjs.com/package/@web-loom/api-logging) | Structured logging with PII/secret redaction; JSON and pretty formats |
| [`@web-loom/api-metrics`](./packages/api-metrics/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-metrics)](https://www.npmjs.com/package/@web-loom/api-metrics) | Prometheus-compatible metrics: counters, gauges, histograms           |
| [`@web-loom/api-tracing`](./packages/api-tracing/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-tracing)](https://www.npmjs.com/package/@web-loom/api-tracing) | Distributed tracing: W3C Trace Context, spans, configurable sampling  |

#### Deployment

| Package                                                                                 | npm                                                                                                                                           | Description                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`@web-loom/api-deployment-vercel`](./packages/api-deployment/vercel/README.md)         | [![npm](https://img.shields.io/npm/v/@web-loom/api-deployment-vercel)](https://www.npmjs.com/package/@web-loom/api-deployment-vercel)         | Vercel Edge / Serverless handler                                        |
| [`@web-loom/api-deployment-cloudflare`](./packages/api-deployment/cloudflare/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-deployment-cloudflare)](https://www.npmjs.com/package/@web-loom/api-deployment-cloudflare) | Cloudflare Workers handler; KV, D1, Durable Objects, Workers AI         |
| [`@web-loom/api-deployment-aws`](./packages/api-deployment/aws/README.md)               | [![npm](https://img.shields.io/npm/v/@web-loom/api-deployment-aws)](https://www.npmjs.com/package/@web-loom/api-deployment-aws)               | AWS Lambda handler; API Gateway V1/V2, Function URLs, RDS Proxy         |
| [`@web-loom/api-deployment-docker`](./packages/api-deployment/docker/README.md)         | [![npm](https://img.shields.io/npm/v/@web-loom/api-deployment-docker)](https://www.npmjs.com/package/@web-loom/api-deployment-docker)         | Docker deployment: Dockerfile, docker-compose, .dockerignore generators |

#### Testing

| Package                                                     | npm                                                                                                               | Description                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`@web-loom/api-testing`](./packages/api-testing/README.md) | [![npm](https://img.shields.io/npm/v/@web-loom/api-testing)](https://www.npmjs.com/package/@web-loom/api-testing) | Test client, data factories, mock adapters, contract testing, benchmarking |

---

### Published to npm — framework internals (rarely installed directly)

These packages are published for extensibility and consumed internally by `api-core` and `api-cli`. You typically won't install them yourself unless building framework extensions.

| Package                                                                          | Description                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`@web-loom/api-shared`](./packages/api-shared/README.md)                        | Shared TypeScript types, error classes, and utility types   |
| [`@web-loom/api-generator-crud`](./packages/api-generators/crud/README.md)       | CRUD route generation from `defineModel` registrations      |
| [`@web-loom/api-generator-openapi`](./packages/api-generators/openapi/README.md) | OpenAPI 3.1 spec generation from routes and Zod schemas     |
| [`@web-loom/api-generator-client`](./packages/api-generators/client/README.md)   | TypeScript client generation from route definitions         |
| [`@web-loom/api-generator-types`](./packages/api-generators/types/README.md)     | TypeScript type generation utilities                        |
| `@web-loom/api-middleware-validation`                                            | **Deprecated** — use `validate()` from `@web-loom/api-core` |

---

### Not published — internal monorepo tooling

| Package                   | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `@repo/eslint-config`     | Shared ESLint configuration (base, Next.js, React)         |
| `@repo/typescript-config` | Shared TypeScript `tsconfig` bases                         |
| `@repo/ui`                | Internal React component stubs used in the admin dashboard |

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
  api-core/              # Core runtime: createApp, defineModel, defineRoutes, validate
  api-shared/            # Shared types, error classes, utility types
  api-cli/               # CLI: webloom init / generate / migrate / dev
  api-middleware/
    auth/                # JWT, session, API key auth; RBAC guards; CSRF
    cache/               # Response caching with TTL and tag invalidation
    cors/                # CORS preflight and header middleware
    rate-limit/          # Token-bucket rate limiting
    validation/          # Deprecated — use validate() from api-core
  api-generators/
    crud/                # Auto-generates CRUD routes from defineModel
    openapi/             # OpenAPI 3.1 spec generation
    client/              # TypeScript client generation
    types/               # Type generation utilities
  api-deployment/
    vercel/              # Vercel Edge/Serverless adapter
    cloudflare/          # Cloudflare Workers adapter (KV, D1, AI)
    aws/                 # AWS Lambda adapter (API GW V1/V2, RDS Proxy)
    docker/              # Dockerfile / docker-compose generators
  api-jobs/              # Background jobs: priority queue, cron, retries
  api-webhooks/          # Webhook delivery with HMAC signing
  api-uploads/           # File uploads: local, S3, R2 backends
  api-health/            # Liveness and readiness health checks
  api-logging/           # Structured logging with secret redaction
  api-metrics/           # Prometheus-compatible metrics collection
  api-tracing/           # Distributed tracing (W3C Trace Context)
  api-plugins/           # Plugin system for framework extensions
  api-testing/           # Test client, factories, mocks, benchmarking
  eslint-config/         # (internal) Shared ESLint config
  typescript-config/     # (internal) Shared tsconfig bases
  ui/                    # (internal) Shared React components
examples/
  minimal/               # Simple CRUD API with JWT auth
  full-stack/            # Full-featured app: jobs, webhooks, uploads
  serverless/            # Multi-platform: Vercel, Cloudflare, Lambda
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
