# Web Loom API Documentation

Web Loom API is a TypeScript meta-framework for building REST APIs on top of [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and [Zod](https://zod.dev). Optimized for serverless and edge computing platforms.

## Table of Contents

### Getting Started

- [Getting Started Guide](./getting-started.md) — Installation, quick start, and your first API in 5 minutes

### Core Concepts

- [Stack Overview](./core-concepts/adapters.md) — How Hono, Drizzle, Zod, and the email layer fit together
- [Model-Driven Development](./core-concepts/models.md) — Drizzle tables, `defineModel()`, CRUD options, schema overrides
- [Configuration Reference](./core-concepts/configuration.md) — `defineConfig()` full schema and driver reference
- [Routing Guide](./core-concepts/routing.md) — File-based routing, `defineRoutes()`, `validate()`, OpenAPI annotations

### API Reference

- [@web-loom/api-core](./api-reference/core.md) — `createApp`, `defineModel`, `defineRoutes`, `validate`, `openApiMeta`, `defineConfig`
- [Auth Middleware](./api-reference/middleware.md) — `jwtAuth`, `sessionAuth`, `apiKeyAuth`, `requireRole`, `composeAuth`, `csrfProtection`
- [Deployment Adapters](./api-reference/deployment.md) — Vercel, Cloudflare, and AWS Lambda entry points

### Deployment Guides

- [Vercel](./deployment/vercel.md) — Deploy to Vercel Edge Functions or Serverless
- [Cloudflare Workers](./deployment/cloudflare.md) — Deploy to Cloudflare Workers
- [AWS Lambda](./deployment/aws-lambda.md) — Deploy to AWS Lambda
- [Docker](./deployment/docker.md) — Containerized Node.js deployment

### Advanced Guides

- [Performance Optimization](./advanced/performance.md) — Cold starts, connection pooling, and bundle size
- [Security Best Practices](./advanced/security.md) — CORS, rate limiting, auth, input sanitization
- [Testing Strategies](./advanced/testing.md) — Unit tests, integration tests with libsql in-memory

## Example Projects

| Example | Description |
|---------|-------------|
| [`examples/minimal`](../examples/minimal) | Bare-bones API with one model and one route file |
| [`examples/serverless`](../examples/serverless) | Same app deployed to Vercel, Cloudflare, and AWS Lambda |
| [`examples/full-stack`](../examples/full-stack) | Production API with auth, OpenAPI docs, and email |

## Package Overview

| Package | Description |
|---------|-------------|
| `@web-loom/api-core` | Core runtime, model registry, route discovery, `defineModel`, `defineRoutes`, `validate`, `openApiMeta` |
| `@web-loom/api-shared` | Shared types and utilities |
| `@web-loom/api-cli` | `webloom` CLI — `init`, `dev`, `generate openapi`, `generate client` |
| `@web-loom/api-middleware-auth` | JWT, session, API key auth; RBAC guards; CSRF protection |
| `@web-loom/api-generator-crud` | Auto-generated CRUD endpoints from model definitions |
| `@web-loom/api-generator-openapi` | OpenAPI 3.1 document + Swagger/Scalar UI serving |
| `@web-loom/api-deployment-vercel` | Vercel deployment handler |
| `@web-loom/api-deployment-cloudflare` | Cloudflare Workers deployment handler |
| `@web-loom/api-deployment-aws` | AWS Lambda deployment handler |
