# Getting Started

Build a production-ready REST API in minutes with Web Loom API.

## Prerequisites

- **Node.js** 20 or later
- **npm**, **pnpm**, or **yarn**
- A PostgreSQL database (local or hosted — [Neon](https://neon.tech) works great for serverless)

## Installation

```bash
# Core package — always required
npm install @web-loom/api-core

# Default adapters
npm install @web-loom/api-adapter-hono @web-loom/api-adapter-drizzle @web-loom/api-adapter-zod

# Middleware (pick what you need)
npm install @web-loom/api-middleware-cors @web-loom/api-middleware-validation

# Dev tools
npm install -D @web-loom/api-cli @web-loom/api-testing
```

Or scaffold a new project with the CLI:

```bash
npx @web-loom/api-cli init my-api
cd my-api
npm install
```

## Quick Start

### 1. Create a configuration file

```typescript
// src/config.ts
import { defineConfig } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";

export default defineConfig({
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  security: {
    cors: { origin: ["*"] },
  },
  features: {
    crud: true,
  },
  observability: {
    logging: { level: "info", format: "json" },
  },
});
```

### 2. Define a model

```typescript
// src/models/user.ts
import { defineModel } from "@web-loom/api-core";

export const User = defineModel({
  name: "User",
  tableName: "users",
  fields: [
    {
      name: "id",
      type: "uuid",
      database: { primaryKey: true, default: "gen_random_uuid()" },
    },
    {
      name: "name",
      type: "string",
      validation: { required: true, minLength: 1, maxLength: 100 },
    },
    {
      name: "email",
      type: "string",
      validation: { required: true, format: "email" },
      database: { unique: true },
    },
  ],
  options: {
    timestamps: true,
    crud: true,
  },
});
```

With `crud: true`, Web Loom automatically generates these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/users` | Create a user |
| `GET` | `/users` | List users (paginated) |
| `GET` | `/users/:id` | Get a user by ID |
| `PUT` | `/users/:id` | Full update |
| `PATCH` | `/users/:id` | Partial update |
| `DELETE` | `/users/:id` | Delete a user |

### 3. Start the app

```typescript
// src/index.ts
import { createApp } from "@web-loom/api-core";
import config from "./config";

async function main() {
  const app = await createApp(config);
  await app.start();
  console.log(`🕸️  Web Loom API running at http://localhost:${app.port}`);
}

main().catch(console.error);
```

### 4. Run it

```bash
# Development mode with hot reload
npx webloom dev

# Or run directly
npx tsx src/index.ts
```

Your API is live. Try it:

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# List users
curl http://localhost:3000/users

# Get a user
curl http://localhost:3000/users/<id>
```

---

## Your First API in 5 Minutes

Let's build a task tracker API from scratch.

### Minute 1 — Scaffold the project

```bash
npx @web-loom/api-cli init task-tracker
cd task-tracker
```

### Minute 2 — Define the Task model

Create `src/models/task.ts`:

```typescript
import { defineModel } from "@web-loom/api-core";

export const Task = defineModel({
  name: "Task",
  tableName: "tasks",
  fields: [
    {
      name: "id",
      type: "uuid",
      database: { primaryKey: true, default: "gen_random_uuid()" },
    },
    {
      name: "title",
      type: "string",
      validation: { required: true, minLength: 1, maxLength: 200 },
    },
    {
      name: "description",
      type: "string",
    },
    {
      name: "status",
      type: "enum",
      validation: { enum: ["todo", "in_progress", "done"] },
      default: "todo",
    },
    {
      name: "priority",
      type: "enum",
      validation: { enum: ["low", "medium", "high"] },
      default: "medium",
    },
    {
      name: "dueDate",
      type: "datetime",
    },
  ],
  options: {
    timestamps: true,
    crud: true,
  },
});
```

### Minute 3 — Add a custom route

Create `src/routes/tasks.ts`:

```typescript
import { defineRoutes } from "@web-loom/api-core";
import { Task } from "../models/task";

export default defineRoutes((router) => {
  // GET /api/tasks/overdue — Find overdue tasks
  router.get("/api/tasks/overdue", {
    handler: async (ctx) => {
      const tasks = await ctx.db
        .select(Task)
        .where("dueDate", "<", new Date())
        .where("status", "!=", "done")
        .orderBy("dueDate", "asc");

      return ctx.json({ tasks });
    },
  });

  // PATCH /api/tasks/:id/complete — Mark a task as done
  router.patch("/api/tasks/:id/complete", {
    handler: async (ctx) => {
      const task = await ctx.db.update(Task, ctx.params.id, {
        status: "done",
      });

      if (!task) return ctx.json({ error: "Task not found" }, 404);
      return ctx.json({ task });
    },
  });
});
```

### Minute 4 — Set up the database

```bash
# Create a .env file
echo 'DATABASE_URL=postgresql://localhost:5432/task_tracker' > .env

# Run migrations
npx webloom migrate up
```

### Minute 5 — Start and test

```bash
npx webloom dev
```

```bash
# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write docs", "priority": "high", "dueDate": "2025-04-01T00:00:00Z"}'

# List all tasks
curl http://localhost:3000/tasks

# Mark it done
curl -X PATCH http://localhost:3000/tasks/<id>/complete

# Check overdue tasks
curl http://localhost:3000/tasks/overdue
```

That's it — a fully functional task tracker API with validation, pagination, and CRUD in 5 minutes.

---

## Next Steps

- [Core Concepts: Adapters](./core-concepts/adapters.md) — Understand the swappable adapter architecture
- [Core Concepts: Models](./core-concepts/models.md) — Field types, validation, relationships
- [Core Concepts: Routing](./core-concepts/routing.md) — File-based routing, middleware, and params
- [Deployment Guides](./deployment/vercel.md) — Deploy to Vercel, Cloudflare, AWS, or Docker
- [Example: Full-Stack](../examples/full-stack) — Auth, caching, webhooks, and background jobs
