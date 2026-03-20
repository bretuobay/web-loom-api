# Full-Stack Example

Production-shaped example showing the current standard plus optional platform modules.

## Stack

- Neon Postgres via `neon-serverless`
- generated CRUD under `/api`
- JWT + API key auth
- jobs via `@web-loom/api-jobs`
- webhooks via `@web-loom/api-webhooks`
- uploads with custom storage wiring

## Route Layout

- generated CRUD:
  - `/api/users`
  - `/api/posts`
  - `/api/comments`
- custom auth routes:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- custom user routes:
  - `POST /api/users/signup`
  - `GET /api/users/admin-list`
  - `POST /api/users/:id/api-key`
- custom post routes:
  - `GET /api/posts/feed`
  - `GET /api/posts/:id/details`
  - `POST /api/posts/create`
  - `PUT /api/posts/:id/edit`
  - `DELETE /api/posts/:id/remove`
- upload routes:
  - `POST /api/uploads/avatar`
  - `DELETE /api/uploads/avatar`

## Why It Exists

This example shows how to keep generated CRUD for baseline operations while still adding richer workflows, ownership checks, jobs, webhook dispatch, and upload handling without drifting from the standard `/api` convention.
