# Web Loom API Docs

These docs now describe the **current standard path**, not the full long-term platform ambition.

## Standard Defaults

- Deployment: Cloudflare Workers
- Database: Neon Postgres via `neon-serverless`
- API base path: `/api`
- Auth: JWT + API key
- OpenAPI: enabled by default

## Start Here

- [Getting Started](./getting-started.md)
- [Core Concepts: Models](./core-concepts/models.md)
- [Core Concepts: Routing](./core-concepts/routing.md)
- [API Reference: Core](./api-reference/core.md)
- [Deployment: Cloudflare Workers](./deployment/cloudflare.md)

## Examples

- [Minimal](../examples/minimal/README.md)
- [Serverless](../examples/serverless/README.md)
- [Full-Stack](../examples/full-stack/README.md)

## Current Support Policy

- `Cloudflare Workers`: standard / tier-1
- `Vercel`, `AWS Lambda`, `Docker`: available in the repo, but not part of the current agency standard

## Important Convention

Route files are mounted under `/api` and should define paths relative to their file mount path.

Examples:

- `src/routes/users.ts` + `routes.get('/')` => `GET /api/users`
- `src/routes/users.ts` + `routes.get('/search')` => `GET /api/users/search`
- `src/routes/auth.ts` + `routes.post('/login')` => `POST /api/auth/login`
