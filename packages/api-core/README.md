# @web-loom/api-core

Core runtime for Web Loom API.

`api-core` is the package that:

- creates the Hono application
- initializes the Drizzle database connection
- injects `c.var.db` and optional `c.var.email`
- mounts generated CRUD routes under `/api`
- mounts discovered route files under `/api`
- serves OpenAPI routes when the generator package is installed

## Install

```bash
npm install \
  @web-loom/api-core \
  @web-loom/api-generator-crud \
  @web-loom/api-generator-openapi \
  drizzle-orm \
  @neondatabase/serverless \
  hono \
  zod
```

## Standard Bootstrap

```ts
import { createApp, defineConfig, defineModel } from '@web-loom/api-core';
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
});

defineModel(usersTable, {
  name: 'User',
  basePath: '/users',
  crud: true,
});

const config = defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
    poolSize: 1,
  },
  routes: { dir: './src/routes' },
  features: { crud: true },
  openapi: { enabled: true, title: 'My API', version: '1.0.0' },
});

const app = await createApp(config);
```

## Runtime Behavior

- generated CRUD routes are mounted under `/api/<resource>`
- discovered route files are mounted under `/api`
- `/health` and `/ready` are always available
- `/openapi.json`, `/openapi.yaml`, and `/docs` are served when `@web-loom/api-generator-openapi` is installed

## Route File Convention

Route handlers are relative to the file mount path.

Example:

```ts
// src/routes/users.ts
import { defineRoutes } from '@web-loom/api-core';

const routes = defineRoutes();

routes.get('/', (c) => c.json({ ok: true })); // GET /api/users
routes.get('/search', (c) => c.json({ ok: true })); // GET /api/users/search

export default routes;
```

Do not repeat the resource path inside the route file.

## Notes

- Automatic CRUD requires `@web-loom/api-generator-crud`.
- Automatic OpenAPI serving requires `@web-loom/api-generator-openapi`.
- The current standard target is Cloudflare Workers with Neon Postgres.
