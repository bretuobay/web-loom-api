# @web-loom/api

A modular REST API meta-framework for building serverless APIs by assembling best-of-breed tools with sensible defaults.

Write once, deploy anywhere — Vercel Edge, Cloudflare Workers, AWS Lambda, or Docker.

## Why Web Loom API?

- **Serverless-first** — optimized for cold starts and edge deployment
- **Modular adapters** — swap databases, auth, email providers via CLI without refactoring
- **Model-driven** — define models once, get validation, CRUD routes, OpenAPI specs, and typed clients
- **Platform-agnostic** — deploy to Vercel, Cloudflare, AWS Lambda, or Docker from the same codebase
- **AI-friendly** — machine-readable schemas and generation-friendly conventions

## Quick Start

```bash
npm install @web-loom/api-core
```

```typescript
import { createApp, defineModel, defineRoutes } from '@web-loom/api-core';

// Define a model
const User = defineModel('User', {
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    email: { type: 'string', required: true },
  },
});

// Define routes
const userRoutes = defineRoutes('/users', {
  'GET /': async (ctx) => {
    return ctx.json(await ctx.db.findMany('users'));
  },
  'POST /': async (ctx) => {
    const data = await ctx.body();
    return ctx.json(await ctx.db.create('users', data), 201);
  },
});

// Create and start the app
const app = createApp({
  models: [User],
  routes: [userRoutes],
  adapters: {
    framework: 'hono',
    database: 'drizzle',
    validation: 'zod',
  },
});
```

## Packages

### Core


| Package | Description |
|---------|-------------|
| `@web-loom/api-core` | Core runtime, model registry, route registry, configuration |
| `@web-loom/api-shared` | Shared types and utilities across all packages |
| `@web-loom/api-cli` | CLI for project scaffolding, code generation, component switching |

### Adapters

| Package | Description |
|---------|-------------|
| `@web-loom/api-adapter-hono` | Hono HTTP framework adapter |
| `@web-loom/api-adapter-drizzle` | Drizzle ORM database adapter |
| `@web-loom/api-adapter-zod` | Zod validation adapter |
| `@web-loom/api-adapter-lucia` | Lucia authentication adapter (sessions, OAuth, API keys) |
| `@web-loom/api-adapter-resend` | Resend email adapter |

### Middleware

| Package | Description |
|---------|-------------|
| `@web-loom/api-middleware-auth` | Session auth, API key auth, RBAC, field permissions |
| `@web-loom/api-middleware-validation` | Request validation and input sanitization |
| `@web-loom/api-middleware-rate-limit` | Token bucket rate limiting (memory + Redis stores) |
| `@web-loom/api-middleware-cors` | CORS with origin whitelist, regex, and credentials support |
| `@web-loom/api-middleware-cache` | Response caching with stale-while-revalidate and tag invalidation |

### Infrastructure

| Package | Description |
|---------|-------------|
| `@web-loom/api-jobs` | Background job queue with priority, cron scheduling, retries |
| `@web-loom/api-uploads` | File uploads with multipart parsing, local/S3/R2 stores |
| `@web-loom/api-webhooks` | Webhook delivery with HMAC-SHA256 signatures and retries |
| `@web-loom/api-plugins` | Plugin system with lifecycle hooks and dependency resolution |

### Observability

| Package | Description |
|---------|-------------|
| `@web-loom/api-logging` | Structured JSON logging with sensitive data sanitization |
| `@web-loom/api-metrics` | Prometheus-compatible metrics collection and `/metrics` endpoint |
| `@web-loom/api-tracing` | Distributed tracing with W3C Trace Context and sampling |
| `@web-loom/api-health` | Health check endpoints (`/health/live`, `/health/ready`) |

### Deployment

| Package | Description |
|---------|-------------|
| `@web-loom/api-deployment-vercel` | Vercel Edge/Serverless handler with KV caching |
| `@web-loom/api-deployment-cloudflare` | Cloudflare Workers with KV, D1, Durable Objects |
| `@web-loom/api-deployment-aws` | AWS Lambda with API Gateway, RDS Proxy, cold start optimization |
| `@web-loom/api-deployment-docker` | Dockerfile and docker-compose generators |

### Testing

| Package | Description |
|---------|-------------|
| `@web-loom/api-testing` | Test client, factories, mocks, contract testing, benchmarking |

## Deploy Anywhere

```typescript
// Vercel Edge
import { createVercelHandler } from '@web-loom/api-deployment-vercel';
export default createVercelHandler(app, { runtime: 'edge' });

// Cloudflare Workers
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
export default { fetch: createCloudflareHandler(app) };

// AWS Lambda
import { createLambdaHandler } from '@web-loom/api-deployment-aws';
export const handler = createLambdaHandler(app);

// Docker
import { generateDockerfile } from '@web-loom/api-deployment-docker';
const dockerfile = generateDockerfile({ nodeVersion: '20-alpine', port: 3000 });
```

## Project Structure

```
packages/
  api-core/              # Core runtime and registries
  api-shared/            # Shared types
  api-cli/               # CLI tools
  api-adapters/          # Framework, DB, auth, email adapters
    hono/ drizzle/ zod/ lucia/ resend/
  api-middleware/         # HTTP middleware
    auth/ validation/ rate-limit/ cors/ cache/
  api-jobs/              # Background jobs
  api-uploads/           # File uploads
  api-webhooks/          # Webhook delivery
  api-plugins/           # Plugin system
  api-logging/           # Structured logging
  api-metrics/           # Prometheus metrics
  api-tracing/           # Distributed tracing
  api-health/            # Health checks
  api-deployment/        # Platform adapters
    vercel/ cloudflare/ aws/ docker/
  api-testing/           # Test utilities
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
- [Core Concepts](./docs/core-concepts/) — adapters, models, configuration, routing
- [API Reference](./docs/api-reference/) — full API documentation
- [Deployment Guides](./docs/deployment/) — Vercel, Cloudflare, AWS, Docker
- [Advanced Guides](./docs/advanced/) — custom adapters, plugins, performance, security, testing

## License

MIT
