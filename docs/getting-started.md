# Getting Started

Build a Cloudflare-first API with Neon, Hono, Drizzle, and Zod.

## Install

```bash
npm install \
  @web-loom/api-core \
  @web-loom/api-generator-crud \
  @web-loom/api-generator-openapi \
  @web-loom/api-middleware-auth \
  @web-loom/api-deployment-cloudflare \
  drizzle-orm \
  @neondatabase/serverless \
  hono \
  zod
```

## 1. Configure the app

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
  security: {
    cors: {
      origins: ['http://localhost:3000'],
      credentials: true,
    },
  },
  observability: {
    logging: { level: 'info', format: 'json' },
  },
});
```

## 2. Define a model

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

This generates:

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

## 3. Add a custom route

```ts
// src/routes/users.ts
import { defineRoutes } from '@web-loom/api-core';
import { usersTable } from '../models/user';
import { ilike } from 'drizzle-orm';

const routes = defineRoutes();

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

Because the file is `src/routes/users.ts`, this route is served at `GET /api/users/search`.

## 4. Create the app

```ts
// src/app.ts
import { createApp } from '@web-loom/api-core';
import config from '../webloom.config';
import './models/user';

export const app = await createApp(config);
```

## 5. Deploy on Cloudflare

```ts
// src/cloudflare/index.ts
import { createCloudflareHandler } from '@web-loom/api-deployment-cloudflare';
import { app } from '../app';

export default {
  fetch: createCloudflareHandler(app),
};
```

## 6. What you get by default

- app routes under `/api`
- generated CRUD under `/api/<resource>`
- `GET /health`
- `GET /ready`
- `GET /openapi.json`
- `GET /openapi.yaml`
- `GET /docs`

## Auth Convention

The standard path uses:

- JWT bearer tokens for user-authenticated routes
- API keys for programmatic access
- `composeAuth()` for routes that accept either mechanism

See the [minimal example](../examples/minimal/README.md) and [full-stack example](../examples/full-stack/README.md) for the current auth shape.
