# Getting Started

Build a production-ready REST API in minutes with Web Loom API.

## Prerequisites

- **Node.js** 20 or later
- **npm**, **pnpm**, or **yarn**
- A database: [Neon](https://neon.tech) (Postgres serverless), [Turso](https://turso.tech) (SQLite edge), or a standard PostgreSQL instance

## Installation

```bash
# Core runtime
npm install @web-loom/api-core

# Drizzle ORM + your database driver (pick one)
npm install drizzle-orm @neondatabase/serverless   # Neon Postgres
npm install drizzle-orm @libsql/client             # Turso / SQLite
npm install drizzle-orm pg                         # Standard Postgres

# CLI for code generation
npm install -D @web-loom/api-cli
```

Or scaffold a new project:

```bash
npx @web-loom/api-cli init my-api
cd my-api
npm install
```

## Quick Start

### 1. Configuration

Create `webloom.config.ts` at the project root:

```typescript
import { defineConfig } from "@web-loom/api-core";

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: "neon-serverless", // "neon-serverless" | "libsql" | "pg"
  },
  routes: {
    dir: "./src/routes", // default — can be omitted
  },
  openapi: {
    enabled: true,
    title: "My API",
    version: "1.0.0",
  },
});
```

`defineConfig()` throws a `ConfigurationError` at startup if `DATABASE_URL` is missing or any field is invalid.

### 2. Define a model

The Drizzle table is the single source of truth. `defineModel()` wraps it to derive Zod validation schemas and register CRUD routes.

```typescript
// src/schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { defineModel } from "@web-loom/api-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Registers the model in the global registry.
// crud: true generates all 6 CRUD endpoints at /users.
export const User = defineModel(usersTable, {
  name: "User",
  crud: true,
});
```

With `crud: true` these endpoints are generated automatically:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List (paginated, filterable, sortable) |
| `POST` | `/users` | Create |
| `GET` | `/users/:id` | Read by ID |
| `PUT` | `/users/:id` | Replace (full update) |
| `PATCH` | `/users/:id` | Partial update |
| `DELETE` | `/users/:id` | Delete |

### 3. Add custom routes

Route files in `src/routes/` are discovered automatically. `defineRoutes()` returns a typed Hono router with `c.var.db` pre-injected.

```typescript
// src/routes/users.ts
import { defineRoutes, validate } from "@web-loom/api-core";
import { z } from "zod";
import { usersTable } from "../schema";
import { eq } from "drizzle-orm";

const app = defineRoutes();

// GET /users/me  (custom endpoint alongside generated CRUD)
app.get("/me", async (c) => {
  const userId = c.req.header("X-User-Id") ?? "";
  const [user] = await c.var.db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
  return c.json({ user });
});

export default app;
```

### 4. Start the server

```typescript
// src/index.ts
import { createApp } from "@web-loom/api-core";
import config from "../webloom.config";
import "./schema"; // import models so they register before createApp

const app = await createApp(config);
await app.start(3000);
console.log("Web Loom API running at http://localhost:3000");
```

### 5. Run it

```bash
# Development
npx tsx src/index.ts

# Or use the CLI dev server (tsx + watch)
npx webloom dev
```

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# List users
curl http://localhost:3000/users

# Paginate, filter, sort
curl "http://localhost:3000/users?page=1&limit=20&sort=-createdAt&search=alice"

# OpenAPI spec
curl http://localhost:3000/openapi.json

# Interactive docs
open http://localhost:3000/docs
```

---

## Your First API in 5 Minutes

### Minute 1 — Project setup

```bash
mkdir task-tracker && cd task-tracker
npm init -y
npm install @web-loom/api-core drizzle-orm @neondatabase/serverless
npm install -D tsx @web-loom/api-cli
```

Create `webloom.config.ts`:

```typescript
import { defineConfig } from "@web-loom/api-core";

export default defineConfig({
  database: { url: process.env.DATABASE_URL!, driver: "neon-serverless" },
  openapi: { enabled: true, title: "Task Tracker", version: "1.0.0" },
});
```

### Minute 2 — Define the schema

```typescript
// src/schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { defineModel } from "@web-loom/api-core";

export const tasksTable = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const Task = defineModel(tasksTable, {
  name: "Task",
  crud: {
    list: { auth: false },
    create: { auth: true },
    update: { auth: true },
    delete: { auth: true },
  },
});
```

### Minute 3 — Custom route

```typescript
// src/routes/tasks.ts
import { defineRoutes } from "@web-loom/api-core";
import { tasksTable } from "../schema";
import { lt, ne } from "drizzle-orm";

const app = defineRoutes();

// GET /tasks/overdue
app.get("/overdue", async (c) => {
  const tasks = await c.var.db
    .select()
    .from(tasksTable)
    .where(lt(tasksTable.dueDate, new Date()))
    // ne requires drizzle-orm; status != "done"
    .limit(50);

  return c.json({ tasks });
});

export default app;
```

### Minute 4 — Entry point

```typescript
// src/index.ts
import { createApp } from "@web-loom/api-core";
import config from "../webloom.config";
import "./schema";

const app = await createApp(config);
await app.start(3000);
```

### Minute 5 — Try it

```bash
export DATABASE_URL=postgresql://localhost:5432/task_tracker
npx tsx src/index.ts
```

```bash
# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write docs", "priority": "high"}'

# List tasks
curl http://localhost:3000/tasks

# Custom: overdue tasks
curl http://localhost:3000/tasks/overdue

# Docs UI
open http://localhost:3000/docs
```

---

## Next Steps

- [Core Concepts: Models](./core-concepts/models.md) — Drizzle tables, schema overrides, CRUD options
- [Core Concepts: Routing](./core-concepts/routing.md) — File-based routing, `validate()`, OpenAPI annotations
- [Core Concepts: Configuration](./core-concepts/configuration.md) — `defineConfig()` full reference
- [API Reference: Auth Middleware](./api-reference/middleware.md) — JWT, session, API key auth
- [Deployment Guides](./deployment/vercel.md) — Vercel, Cloudflare, AWS
