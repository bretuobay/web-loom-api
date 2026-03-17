# Web Loom API Documentation

Welcome to the Web Loom API framework documentation. Web Loom API is a TypeScript meta-framework for building production-ready REST APIs optimized for serverless and edge computing platforms.

## Table of Contents

### Getting Started

- [Getting Started Guide](./getting-started.md) — Installation, quick start, and your first API in 5 minutes

### Core Concepts

- [Adapter System](./core-concepts/adapters.md) — Swappable architecture for API, database, validation, auth, and email
- [Model-Driven Development](./core-concepts/models.md) — Define models once, generate everything
- [Configuration Reference](./core-concepts/configuration.md) — `defineConfig()` options, environment variables, and adapter config
- [Routing Guide](./core-concepts/routing.md) — File-based routing, `defineRoutes()`, HTTP methods, middleware, and params

### API Reference

- [@web-loom/api-core](./api-reference/core.md) — Core runtime, `createApp`, `defineModel`, `defineRoutes`, `defineConfig`
- [Middleware Packages](./api-reference/middleware.md) — Auth, CORS, rate limiting, and validation middleware
- [Adapter Packages](./api-reference/adapters.md) — Hono, Drizzle, Zod, Lucia, and Resend adapters
- [Testing Utilities](./api-reference/testing.md) — `TestClient`, factories, mocks, and assertions
- [Deployment Adapters](./api-reference/deployment.md) — Vercel, Cloudflare, and AWS Lambda adapters

### Deployment Guides

- [Vercel](./deployment/vercel.md) — Deploy to Vercel Edge Functions
- [Cloudflare Workers](./deployment/cloudflare.md) — Deploy to Cloudflare Workers
- [AWS Lambda](./deployment/aws-lambda.md) — Deploy to AWS Lambda
- [Docker](./deployment/docker.md) — Containerized deployment

### Advanced Guides

- [Custom Adapter Development](./advanced/custom-adapters.md) — Build your own database, auth, or email adapter
- [Plugin Development](./advanced/plugins.md) — Extend the framework with plugins
- [Performance Optimization](./advanced/performance.md) — Cold starts, caching, connection pooling, and bundle size
- [Security Best Practices](./advanced/security.md) — CORS, rate limiting, auth, input sanitization, and headers
- [Testing Strategies](./advanced/testing.md) — Unit tests, property-based tests, contract tests, and benchmarks

## Example Projects

| Example | Description |
|---------|-------------|
| [`examples/minimal`](../examples/minimal) | Bare-bones API with one model and one route file |
| [`examples/serverless`](../examples/serverless) | Same app deployed to Vercel, Cloudflare, and AWS Lambda |
| [`examples/full-stack`](../examples/full-stack) | Production-ready API with auth, caching, webhooks, and jobs |

## Package Overview

| Package | Description |
|---------|-------------|
| `@web-loom/api-core` | Core runtime, registries, and interfaces |
| `@web-loom/api-adapter-hono` | Hono HTTP framework adapter |
| `@web-loom/api-adapter-drizzle` | Drizzle ORM + Neon database adapter |
| `@web-loom/api-adapter-zod` | Zod validation adapter |
| `@web-loom/api-adapter-lucia` | Lucia authentication adapter |
| `@web-loom/api-adapter-resend` | Resend email adapter |
| `@web-loom/api-middleware-auth` | Authentication middleware |
| `@web-loom/api-middleware-cors` | CORS middleware |
| `@web-loom/api-middleware-rate-limit` | Rate limiting middleware |
| `@web-loom/api-middleware-validation` | Request validation middleware |
| `@web-loom/api-generator-crud` | Automatic CRUD route generation |
| `@web-loom/api-generator-openapi` | OpenAPI 3.1 spec generation |
| `@web-loom/api-generator-client` | Type-safe client generation |
| `@web-loom/api-generator-types` | TypeScript type generation |
| `@web-loom/api-testing` | Test client, factories, and mocks |
| `@web-loom/api-deployment-vercel` | Vercel deployment adapter |
| `@web-loom/api-deployment-cloudflare` | Cloudflare Workers deployment adapter |
| `@web-loom/api-deployment-aws` | AWS Lambda deployment adapter |
| `@web-loom/api-cli` | CLI for scaffolding, generation, and dev server |
| `@web-loom/api-shared` | Shared types and utilities |
