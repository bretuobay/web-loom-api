# API Reference: Stack Packages

The framework is built directly on Hono, Drizzle ORM, and Zod — no adapter abstraction layer. This page documents the integration points between these libraries and Web Loom API.

---

## Database — Drizzle ORM

`c.var.db` is a raw Drizzle ORM instance injected by the framework. Its type is `AnyDrizzleDB` (typed as `any` to work with all drivers), but you can narrow it in your routes for full inference:

```typescript
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

app.get('/users', async (c) => {
  const db = c.var.db as NeonDatabase<typeof schema>;
  const users = await db.select().from(schema.usersTable);
  return c.json({ users });
});
```

### Drivers

| Driver               | `defineConfig` value | Package                    |
| -------------------- | -------------------- | -------------------------- |
| Neon Postgres (HTTP) | `"neon-serverless"`  | `@neondatabase/serverless` |
| Turso / SQLite       | `"libsql"`           | `@libsql/client`           |
| Standard Postgres    | `"pg"`               | `pg`                       |

### Direct Drizzle Usage

You can use the full Drizzle API in route handlers:

```typescript
import { eq, and, gt, like, desc } from 'drizzle-orm';
import { usersTable } from './schema';

// Select with filtering and sorting
const users = await c.var.db
  .select()
  .from(usersTable)
  .where(and(eq(usersTable.active, true), gt(usersTable.createdAt, new Date('2025-01-01'))))
  .orderBy(desc(usersTable.createdAt))
  .limit(20);

// Insert with returning
const [user] = await c.var.db
  .insert(usersTable)
  .values({ name: 'Alice', email: 'alice@example.com' })
  .returning();

// Update
await c.var.db.update(usersTable).set({ name: 'Bob' }).where(eq(usersTable.id, userId));

// Delete
await c.var.db.delete(usersTable).where(eq(usersTable.id, userId));

// Transaction
const result = await c.var.db.transaction(async (tx) => {
  const [user] = await tx.insert(usersTable).values(userData).returning();
  const [profile] = await tx.insert(profilesTable).values({ userId: user.id }).returning();
  return { user, profile };
});
```

---

## Validation — Zod

Use `validate(target, schema)` from `@web-loom/api-core` to attach Zod validation as Hono middleware:

```typescript
import { validate } from '@web-loom/api-core';
import { z } from 'zod';

app.post(
  '/',
  validate(
    'json',
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().int().positive().optional(),
    })
  ),
  async (c) => {
    const data = c.req.valid('json'); // typed
    // ...
  }
);
```

Model schemas are available directly from the model object:

```typescript
import { User } from './schema';

// insertSchema — all required fields
validate('json', User.insertSchema);

// updateSchema — all fields optional (for PATCH)
validate('json', User.updateSchema);

// selectSchema — full row shape
User.selectSchema;
```

---

## Email — `EmailAdapter` Interface

The email adapter interface:

```typescript
interface EmailAdapter {
  send(message: EmailMessage): Promise<EmailResult>;
  sendBatch(messages: EmailMessage[]): Promise<EmailResult[]>;
}

interface EmailMessage {
  to: string | string[];
  from?: string; // overrides default from config
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}
```

Pass an implementation to `defineConfig()`:

```typescript
import { ResendAdapter } from '@web-loom/api-shared';

defineConfig({
  database: { url: '...', driver: 'neon-serverless' },
  email: new ResendAdapter({
    apiKey: process.env.RESEND_API_KEY!,
    from: 'noreply@example.com',
  }),
});
```

Access in routes:

```typescript
app.post('/contact', async (c) => {
  const { message } = c.req.valid('json');
  await c.var.email!.send({
    to: 'support@example.com',
    subject: 'New contact message',
    text: message,
  });
  return c.body(null, 204);
});
```

---

## Hono

Web Loom routes are standard Hono. See [Hono's documentation](https://hono.dev/docs) for the full API.

The application's Hono instance is accessible after `createApp()`:

```typescript
const app = await createApp(config);

// Register global middleware
app.hono.use('/*', myMiddleware);

// Add routes not managed by file discovery
app.hono.get('/custom', (c) => c.text('hello'));
```
