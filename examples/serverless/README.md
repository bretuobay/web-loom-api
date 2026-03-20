# Serverless Example

Canonical Cloudflare-first example for the current agency standard.

## Defaults Demonstrated

- Cloudflare Workers as the runtime
- Neon Postgres via `neon-serverless`
- generated CRUD under `/api/items`
- custom search route under `/api/items/search`
- health endpoint at `/api/health`
- OpenAPI at `/openapi.json` and `/docs`

## Files

- `src/shared/app.ts` defines the app once
- `src/cloudflare/index.ts` exposes the Worker handler
- `src/shared/models/item.ts` registers the item model for CRUD generation

## Main Endpoints

- `GET /api/health`
- `GET /api/items`
- `POST /api/items`
- `GET /api/items/:id`
- `PUT /api/items/:id`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`
- `GET /api/items/search`
- `GET /openapi.json`
- `GET /docs`

## Current Support Note

This example is the reference path for the framework right now. The Vercel and AWS deployment packages still exist in the repo, but Cloudflare is the only tier-1 standard target.
