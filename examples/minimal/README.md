# Minimal Example

Smallest standard-style example using:

- Neon Postgres via `neon-serverless`
- generated CRUD under `/api/users`
- JWT auth routes under `/api/auth`
- custom user routes under `/api/users`
- OpenAPI at `/openapi.json` and `/docs`

## What It Shows

- `defineModel()` for model-driven CRUD
- `createApp()` with the default `/api` route base
- JWT login with `jwtAuth()`
- custom routes that do not conflict with generated CRUD

## Important Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id/profile`
- `GET /api/users/me`
- `GET /openapi.json`
- `GET /docs`

## Notes

- The route file `src/routes/users.ts` defines paths relative to `/api/users`.
- The route file `src/routes/auth.ts` defines paths relative to `/api/auth`.
