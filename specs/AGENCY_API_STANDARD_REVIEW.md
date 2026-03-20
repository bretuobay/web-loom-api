# Web Loom API Agency Standard Outcome

_Date: 2026-03-20_

## Summary

This repo is now aligned to a **Cloudflare-first agency API standard** for serverless web apps.

The implemented standard is:

- Deployment target: **Cloudflare Workers**
- Database default: **Neon Postgres** via `neon-serverless`
- Route base: **`/api`**
- API docs: **OpenAPI enabled by default** at `/openapi.json`, `/openapi.yaml`, and `/docs`
- Health endpoints: **`/health`** and **`/ready`**
- Runtime shape: **model-driven CRUD plus file-based custom routes**

This closes the largest gap from the review: **documentation drift between the root README, docs, examples, templates, and implementation**.

## Implemented Outcome

### 1. Standard runtime behavior

`createApp()` now supports the default agency path without requiring manual extension wiring:

- auto-loads CRUD generation when `features.crud !== false`
- mounts generated CRUD routes under `/api/<resource>`
- auto-loads OpenAPI routes when `openapi.enabled !== false`
- mounts file-discovered route modules under `/api`
- keeps `/health`, `/ready`, `/openapi.json`, `/openapi.yaml`, and `/docs` outside `/api`
- collects route metadata from discovered routes for OpenAPI generation

### 2. Standard documentation

The following were rewritten to describe the same supported path:

- root `README.md`
- `docs/README.md`
- `docs/getting-started.md`
- `docs/api-reference/core.md`
- `docs/core-concepts/routing.md`
- `docs/core-concepts/models.md`
- `packages/api-core/README.md`
- `packages/api-cli/README.md`

The repo now documents **Cloudflare Workers** as the v1 standard target and treats other deployment packages as available but non-standard for the agency default path.

### 3. Standard examples

Examples were updated so they no longer contradict the runtime:

- `examples/minimal`
- `examples/full-stack`
- `examples/serverless`

They now align on:

- `neon-serverless`
- `/api` route base
- OpenAPI enabled
- custom routes written as relative route modules
- generated CRUD and custom routes coexisting without path collisions

### 4. Standard CLI templates

CLI templates were updated to remove stale package references and old config shapes.

Templates now scaffold the same direction documented elsewhere:

- Cloudflare-first deployment story
- Neon-first database config
- `/api` route convention
- OpenAPI defaults

## Verification

Verified locally:

- `npm run check-types`
- `npm test`

Both pass after the implementation changes.

## Remaining Gaps Before Broad Agency Rollout

The repo is in a much better position to become the standard, but a few important agency-level gaps still remain.

### 1. Auth standard is documented directionally, not fully productized

The standard direction is **JWT for users + API keys for programmatic access**, but the repo still needs one canonical, production-style auth starter that proves:

- login flow
- token issuance/verification
- API key issuance and rotation
- route protection defaults
- role/permission conventions

### 2. No single canonical agency starter app yet

The examples are aligned, but there is still not one clearly designated **golden reference app** that every team should clone.

That starter should prove:

- model registration
- generated CRUD
- custom routes
- OpenAPI
- auth
- Cloudflare entrypoint
- migrations
- basic observability

### 3. Product standards are still underdefined

The platform still needs explicit standards for:

- error envelope
- pagination/filter/sort format
- versioning policy
- multi-tenant ownership conventions
- RBAC baseline
- idempotency rules for writes and webhooks
- migration rollout policy
- testing baseline for API projects

### 4. Support tiers should be made explicit

The repo still needs a formal package support matrix:

- required
- recommended
- optional
- experimental

That should be documented as part of the agency standard, with Cloudflare marked as tier-1 for v1.

## Recommended Next Implementation Phase

To finish productizing this as the agency default, the next phase should create a dedicated **`v1 agency starter`** that includes:

- Cloudflare Worker entrypoint
- Neon schema + migration workflow
- JWT auth
- API key auth
- one protected CRUD resource
- one webhook example
- one background job example
- standard logging/metrics/health
- typed client generation from OpenAPI

## Decision

`@web-loom/api` is now structurally aligned enough to serve as the **base of the agency API standard**, with Cloudflare as the default deployment target.

It is not yet the complete finished standard for every product team. The next work should focus on **auth productization, one canonical starter, and explicit product conventions** rather than adding more platform surface area.
