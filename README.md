# @web-loom/api

Cloudflare-first REST API framework and package platform for agency products built on Hono, Drizzle ORM, and Zod.

## Standard V1

The current agency standard path is:

- Deployment: **Cloudflare Workers**
- Database: **Neon Postgres** with `neon-serverless`
- Route base: **`/api`**
- Auth: **JWT + API key**
- Contracts: **OpenAPI + `/docs` enabled by default**

Other deployment packages remain in the repo, but Cloudflare is the only tier-1 target for the current standard.

## What Web Loom API Does

- boots a Hono app with a Drizzle database connection
- discovers route files and mounts them under `/api`
- generates CRUD routes from `defineModel()` registrations
- serves `/openapi.json`, `/openapi.yaml`, and `/docs`
- keeps application code portable across serverless runtimes

## Install

```bash
npm install \
  @web-loom/api-core \
  @web-loom/api-generator-crud \
  @web-loom/api-generator-openapi \
  @web-loom/api-middleware-auth \
  drizzle-orm \
  @neondatabase/serverless \
  hono \
  zod
```

For Cloudflare deployment:

```bash
npm install @web-loom/api-deployment-cloudflare
```

## Quick Start

```ts
// webloom.config.ts
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
    poolSize: 1,
  },
  routes: { dir: './src/routes' },
  features: { crud: true },
  openapi: {
    enabled: true,
    title: 'My API',
    version: '1.0.0',
  },
  observability: {
    logging: { level: 'info', format: 'json' },
  },
});
```

```ts
// src/models/user.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const UserModel = defineModel(usersTable, {
  name: 'User',
  basePath: '/users',
  crud: true,
});
```

```ts
// src/routes/users.ts
import { defineRoutes } from '@web-loom/api-core';
import { usersTable } from '../models/user';
import { ilike } from 'drizzle-orm';

const routes = defineRoutes();

// Mounted at /api/users/search because the file lives at src/routes/users.ts
routes.get('/search', async (c) => {
  const q = c.req.query('q') ?? '';
  const users = await c.var.db
    .select()
    .from(usersTable)
    .where(ilike(usersTable.name, `%${q}%`))
    .limit(20);

  return c.json({ users });
});

export default routes;
```

```ts
// src/app.ts
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';
import './models/user';

export const app = await createApp(config);
```

```ts
// src/cloudflare/index.ts
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { app } from '../app';

export default {
  fetch: createCloudflareHandler(app),
};
```

## Default Routes

With the standard path enabled:

- generated CRUD lives under `/api/<resource>`
- discovered route files live under `/api/...`
- health endpoints live at `/health` and `/ready`
- OpenAPI lives at `/openapi.json` and `/openapi.yaml`
- docs UI lives at `/docs`

Example:

- `src/routes/users.ts` + `routes.get('/search')` => `GET /api/users/search`
- `defineModel(... basePath: '/users', crud: true)` => CRUD at `/api/users` and `/api/users/:id`

## Examples

- [examples/serverless](/home/bretuobay/prjts/web-loom-api/examples/serverless) is the canonical Cloudflare-first example
- [examples/minimal](/home/bretuobay/prjts/web-loom-api/examples/minimal) shows the smallest Neon + JWT flow
- [examples/full-stack](/home/bretuobay/prjts/web-loom-api/examples/full-stack) shows jobs, webhooks, uploads, and richer auth patterns

## Package Baseline

Recommended baseline for agency apps:

- `@web-loom/api-core`
- `@web-loom/api-generator-crud`
- `@web-loom/api-generator-openapi`
- `@web-loom/api-middleware-auth`
- `@web-loom/api-health`
- `@web-loom/api-logging`
- `@web-loom/api-metrics`
- `@web-loom/api-deployment-cloudflare`

Optional extensions:

- `@web-loom/api-jobs`
- `@web-loom/api-webhooks`
- `@web-loom/api-uploads`

## Notes

- Route files should define paths relative to their file mount path. A file at `src/routes/users.ts` should use `routes.get('/')`, `routes.get('/search')`, and `routes.get('/:id/details')`, not `routes.get('/users')`.
- Automatic CRUD and OpenAPI serving require `@web-loom/api-generator-crud` and `@web-loom/api-generator-openapi` to be installed.
- Vercel, AWS, and Docker packages remain available, but they are not part of the current standard path.
