# API Reference: @web-loom/api-core

The core package provides the runtime, model system, routing, validation, OpenAPI annotation, and the primary configuration API.

---

## `createApp(config, options?)`

Creates and initializes a Web Loom application.

```typescript
function createApp(
  config: WebLoomConfig,
  options?: CreateAppOptions,
): Promise<Application>;

interface CreateAppOptions {
  /**
   * Callback to register CRUD routes on the Hono instance.
   * Used internally by @web-loom/api-generator-crud to avoid circular deps.
   */
  crudGenerator?: (hono: Hono<any>, models: AnyModel[]) => void;

  /**
   * Callback to register OpenAPI routes.
   * Used internally by @web-loom/api-generator-openapi.
   */
  openapiSetup?: (
    hono: Hono<any>,
    models: AnyModel[],
    routeMetas: unknown[],
    config: OpenApiConfig,
  ) => Promise<void>;
}
```

**Usage:**

```typescript
import { createApp } from "@web-loom/api-core";
import config from "../webloom.config";
import "./schema"; // ensure models are registered before createApp

const app = await createApp(config);
await app.start(3000);
```

**Returns:** `Application` — see below.

---

## `Application`

```typescript
interface Application {
  /** The underlying Hono instance */
  hono: Hono<{ Variables: WebLoomVariables }>;

  /** The active Drizzle ORM connection */
  db: AnyDrizzleDB;

  /**
   * Start an HTTP server on Node.js / Docker.
   * Uses @hono/node-server. For serverless use handleRequest() instead.
   */
  start(port?: number): Promise<void>;

  /**
   * Handle a single Request and return a Response.
   * Use this in serverless/edge environments.
   *
   * @example
   * export default { fetch: (req) => app.handleRequest(req) };
   */
  handleRequest(request: Request): Promise<Response>;

  /**
   * Gracefully shut down. Closes the HTTP server, waits for in-flight
   * requests, and tears down the database connection.
   */
  shutdown(timeout?: number): Promise<void>;

  /** Model registry — populated by defineModel() calls */
  getModelRegistry(): ModelRegistry;

  /** Route registry — populated during route file discovery */
  getRouteRegistry(): RouteRegistry;
}
```

---

## `defineConfig(config)`

Validates a configuration object and resolves environment variable placeholders.

```typescript
function defineConfig(config: WebLoomConfig): WebLoomConfig;
```

Throws `ConfigurationError` if `database.url` is missing or any field fails validation.

**Usage:**

```typescript
import { defineConfig } from "@web-loom/api-core";

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: "neon-serverless",
  },
  routes: { dir: "./src/routes" },
  openapi: { enabled: true, title: "My API", version: "1.0.0" },
});
```

See [Configuration Reference](../core-concepts/configuration.md) for the full schema.

---

## `defineModel(table, meta, overrides?)`

Registers a Drizzle table as a Web Loom model. Derives Zod schemas via `drizzle-zod` and auto-registers with the global `ModelRegistry`.

```typescript
function defineModel<TTable extends Table>(
  table: TTable,
  meta: ModelMeta,
  overrides?: SchemaOverrides,
): Model<TTable>;

interface ModelMeta {
  name: string;           // PascalCase, e.g. "User"
  basePath?: string;      // URL prefix; default: "/" + name.toLowerCase() + "s"
  crud?: boolean | CrudOptions;
}

interface CrudOptions {
  timestamps?: boolean;       // inject createdAt/updatedAt on write
  softDelete?: boolean;       // DELETE sets deletedAt; List/Read filter it out
  list?:   CrudOperationOptions;
  read?:   CrudOperationOptions;
  create?: CrudOperationOptions;
  update?: CrudOperationOptions;
  delete?: CrudOperationOptions;
}

interface CrudOperationOptions {
  auth?: boolean | string; // false = public | true = authenticated | "admin" = role
}

interface SchemaOverrides {
  insert?: (schema: ZodObject<ZodRawShape>) => ZodObject<ZodRawShape>;
  select?: (schema: ZodObject<ZodRawShape>) => ZodObject<ZodRawShape>;
  update?: (schema: ZodObject<ZodRawShape>) => ZodObject<ZodRawShape>;
}
```

**Returns:** `Model<TTable>` with:

```typescript
interface Model<TTable extends Table> {
  table: TTable;
  insertSchema: ZodObject<ZodRawShape>;  // POST / PUT body
  selectSchema: ZodObject<ZodRawShape>;  // response shape
  updateSchema: ZodObject<ZodRawShape>;  // PATCH body (all fields optional)
  meta: Required<ModelMeta>;
  $inferSelect: TTable['$inferSelect'];  // TypeScript row type
  $inferInsert: TTable['$inferInsert'];  // TypeScript insert type
}
```

**Example:**

```typescript
import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { defineModel } from "@web-loom/api-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

export const User = defineModel(usersTable, {
  name: "User",
  crud: { list: { auth: false }, create: { auth: true } },
});
```

---

## `defineRoutes()`

Returns a `Hono<{ Variables: WebLoomVariables }>` instance with `c.var.db` and `c.var.email` pre-typed. Use as the default export of every route file.

```typescript
function defineRoutes(): Hono<{ Variables: WebLoomVariables }>;
```

**Example:**

```typescript
// src/routes/users.ts
import { defineRoutes } from "@web-loom/api-core";
import { usersTable } from "../schema";

const app = defineRoutes();

app.get("/", async (c) => {
  const users = await c.var.db.select().from(usersTable);
  return c.json({ users });
});

export default app;
```

---

## `validate(target, schema)`

Validation middleware built on `@hono/zod-validator`. Formats Zod errors into the standard `VALIDATION_ERROR` response and attaches a `requestId`.

```typescript
function validate<T extends keyof ValidationTargets>(
  target: T,
  schema: ZodSchema,
): MiddlewareHandler;
```

Validation targets: `"json"` | `"query"` | `"param"` | `"form"` | `"header"`

**Example:**

```typescript
import { validate } from "@web-loom/api-core";
import { z } from "zod";

app.post(
  "/",
  validate("json", z.object({ name: z.string(), email: z.string().email() })),
  async (c) => {
    const data = c.req.valid("json"); // fully typed
    // ...
  },
);
```

---

## `openApiMeta(meta)`

Attaches OpenAPI metadata to a route handler via a no-op middleware. Does not affect request processing.

```typescript
function openApiMeta(meta: RouteMeta): MiddlewareHandler;

interface RouteMeta {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  request?: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  };
  responses?: Record<number, {
    description: string;
    schema?: ZodSchema;
  }>;
}
```

**Example:**

```typescript
import { openApiMeta } from "@web-loom/api-core";

app.post(
  "/send-invite",
  openApiMeta({
    summary: "Send invitation email",
    tags: ["invites"],
    operationId: "sendInvite",
    request: { body: z.object({ email: z.string().email() }) },
    responses: { 204: { description: "Sent" } },
  }),
  validate("json", z.object({ email: z.string().email() })),
  async (c) => { ... },
);
```

---

## `serializeModel(record)`

Serializes a database row for JSON output. Handles `Date` → ISO string, `BigInt` → string, `Buffer` → base64.

```typescript
function serializeModel(record: Record<string, unknown>): Record<string, unknown>;
```

---

## `WebLoomVariables`

The Hono context variable map injected by the framework:

```typescript
interface WebLoomVariables {
  db: AnyDrizzleDB;       // Drizzle ORM instance
  email?: EmailAdapter;   // email adapter (when config.email is set)
  user?: AuthUser;        // set by auth middleware (augmented by @web-loom/api-middleware-auth)
}
```

---

## `ModelRegistry`

```typescript
interface ModelRegistry {
  register(model: AnyModel): void;
  get(name: string): AnyModel | undefined;
  getAll(): AnyModel[];
  has(name: string): boolean;
}
```

Throws `DuplicateModelError` on double-registration.

---

## Error Types

```typescript
class ConfigurationError extends Error { }   // invalid or missing config
class DuplicateModelError extends Error { }  // model registered twice
class RouteConflictError extends Error { }   // two files map to the same route
```

---

## Standard Error Response Shape

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
    path?: string;
  };
}
```

| Status | Code |
|--------|------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_ERROR` |
