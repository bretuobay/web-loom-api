# Model-Driven Development

In Web Loom API, the **Drizzle table definition is the single source of truth**. `defineModel()` wraps a Drizzle table to:

1. Derive Zod validation schemas automatically via `drizzle-zod`
2. Register the model in the global `ModelRegistry`
3. Signal the CRUD generator to produce routes (when `crud: true`)
4. Provide schema data to the OpenAPI generator

## Defining a Model

```typescript
import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { defineModel } from "@web-loom/api-core";

// Step 1: Drizzle table (your schema, unchanged)
export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Step 2: Register with Web Loom
export const User = defineModel(usersTable, {
  name: "User",           // PascalCase — used in OpenAPI, error messages
  basePath: "/users",     // optional; defaults to "/" + name.toLowerCase() + "s"
  crud: true,             // generate all 6 CRUD routes
});
```

## `ModelMeta` Options

```typescript
interface ModelMeta {
  /** PascalCase name, e.g. "User", "BlogPost" */
  name: string;

  /** URL prefix for CRUD routes. Default: "/" + name.toLowerCase() + "s" */
  basePath?: string;

  /**
   * true  — all 6 CRUD operations with public access
   * false — no CRUD routes generated (default)
   * object — fine-grained control per operation
   */
  crud?: boolean | CrudOptions;
}
```

## Fine-Grained CRUD Options

Control auth requirements per operation:

```typescript
export const Post = defineModel(postsTable, {
  name: "Post",
  crud: {
    timestamps: true,          // auto-manage createdAt/updatedAt injection
    softDelete: true,          // DELETE sets deletedAt instead of removing the row
    list:   { auth: false },   // public
    read:   { auth: false },   // public
    create: { auth: true },    // any authenticated user
    update: { auth: "owner" }, // role: "owner" (custom string checked by your auth)
    delete: { auth: "admin" }, // role: "admin"
  },
});
```

`auth` values:

| Value | Behaviour |
|-------|-----------|
| `false` / absent | No auth required |
| `true` | `authenticate` middleware — rejects if `c.var.user` is not set |
| `"admin"` (any string) | `authenticate` + `requireRole("admin")` |

## Schema Overrides

`drizzle-zod` auto-generates schemas from your column definitions. Use the optional `overrides` parameter to transform them:

```typescript
import { z } from "zod";

export const User = defineModel(
  usersTable,
  { name: "User", crud: true },
  {
    // Tighten the insert schema — require password on creation
    insert: (schema) =>
      schema.extend({
        password: z.string().min(8),
      }),

    // Strip internal fields from select responses
    select: (schema) =>
      schema.omit({ deletedAt: true }),

    // Keep update schema as-is (partial of insert is the default)
    update: (schema) => schema,
  },
);
```

The three derived schemas available on the model:

| Schema | Used for | Contents |
|--------|----------|----------|
| `insertSchema` | POST / PUT body validation | All non-generated columns (no `defaultRandom`, etc.) |
| `selectSchema` | Response typing, OpenAPI responses | All columns |
| `updateSchema` | PATCH body validation | `insertSchema.partial()` (all fields optional) |

## Accessing Schemas in Routes

Use the model's schemas in custom routes for consistent validation:

```typescript
import { defineRoutes, validate } from "@web-loom/api-core";
import { User, usersTable } from "../schema";

const app = defineRoutes();

app.post(
  "/register",
  validate("json", User.insertSchema),
  async (c) => {
    const data = c.req.valid("json"); // typed as User insert shape
    const [user] = await c.var.db
      .insert(usersTable)
      .values(data)
      .returning();
    return c.json({ user }, 201);
  },
);

// Partial update using the updateSchema
app.patch(
  "/:id",
  validate("json", User.updateSchema),
  async (c) => {
    const patch = c.req.valid("json");
    // ...
  },
);
```

## Type Inference

```typescript
import type { InferModel } from "@web-loom/api-core";

type UserRow = InferModel<typeof User>["select"]; // typeof usersTable.$inferSelect
type NewUser = InferModel<typeof User>["insert"]; // typeof usersTable.$inferInsert
```

Or use Drizzle's own inference directly:

```typescript
type UserRow = typeof usersTable.$inferSelect;
type NewUser = typeof usersTable.$inferInsert;
```

## Soft Delete

When `crud.softDelete: true`, the CRUD generator:

- **DELETE** — sets `deletedAt = NOW()` instead of removing the row
- **List** — appends `WHERE deleted_at IS NULL` automatically
- **Read** — appends `WHERE deleted_at IS NULL` automatically

Your table must have a nullable `deletedAt` timestamp column:

```typescript
export const postsTable = pgTable("posts", {
  // ...
  deletedAt: timestamp("deleted_at"), // nullable — no .notNull()
});
```

## Model Registry

All models registered via `defineModel()` are available through the app:

```typescript
const app = await createApp(config);
const registry = app.getModelRegistry();

registry.getAll();                   // AnyModel[]
registry.get("User");                // AnyModel | undefined
registry.has("User");                // boolean
```

The registry is consumed by the CRUD generator and OpenAPI generator at startup.

## Serialization

`serializeModel()` handles JSON serialization edge cases:

```typescript
import { serializeModel } from "@web-loom/api-core";

const row = await c.var.db.select().from(usersTable).limit(1);
return c.json(serializeModel(row[0]));
```

Coercions applied:

| Type | Serialized As |
|------|--------------|
| `Date` | ISO 8601 string |
| `BigInt` | string (avoids JS precision loss) |
| `Buffer` | base64 string |
