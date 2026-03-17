# API Reference: @web-loom/api-core

The core package provides the runtime, registries, interfaces, and primary API functions.

## `createApp(config, options?)`

Creates and initializes a Web Loom application.

```typescript
function createApp(
  config: WebLoomConfig,
  options?: CreateAppOptions
): Promise<Application>;

interface CreateAppOptions {
  routes?: RouteDefinition[];
}
```

**Usage:**

```typescript
import { createApp } from "@web-loom/api-core";
import config from "./config";

const app = await createApp(config);
await app.start();
```

**Returns:** `Application` instance with:

```typescript
interface Application {
  // Lifecycle
  start(): Promise<void>;
  shutdown(timeout?: number): Promise<void>;

  // Request handling
  handleRequest(request: Request): Promise<Response>;

  // Middleware
  use(middleware: Middleware): void;

  // Registries
  getModelRegistry(): ModelRegistry;
  getRouteRegistry(): RouteRegistry;

  // Adapters
  db: DatabaseAdapter;
  auth: AuthAdapter;
  email: EmailAdapter;

  // Features
  webhooks: WebhookManager;
  jobs: JobQueue;
  cache: CacheManager;

  // Info
  port: number;
}
```

---

## `defineConfig(config)`

Creates a validated configuration object with TypeScript type checking.

```typescript
function defineConfig(config: WebLoomConfig): WebLoomConfig;
```

**Usage:**

```typescript
import { defineConfig } from "@web-loom/api-core";

export default defineConfig({
  adapters: { api: honoAdapter(), database: drizzleAdapter(), validation: zodAdapter() },
  database: { url: process.env.DATABASE_URL! },
  security: { cors: { origin: ["*"] } },
  features: { crud: true },
  observability: { logging: { level: "info", format: "json" } },
});
```

See [Configuration Reference](../core-concepts/configuration.md) for the full schema.

---

## `defineModel(definition)`

Defines a data model for CRUD generation, validation, and database schema.

```typescript
function defineModel(definition: ModelDefinition): Model;

interface ModelDefinition {
  name: string;
  tableName?: string;
  fields: FieldDefinition[];
  relationships?: Relationship[];
  options?: ModelOptions;
  metadata?: ModelMetadata;
}
```

**Usage:**

```typescript
import { defineModel } from "@web-loom/api-core";

export const Task = defineModel({
  name: "Task",
  tableName: "tasks",
  fields: [
    { name: "id", type: "uuid", database: { primaryKey: true, default: "gen_random_uuid()" } },
    { name: "title", type: "string", validation: { required: true, maxLength: 200 } },
    { name: "status", type: "enum", validation: { enum: ["todo", "done"] }, default: "todo" },
  ],
  options: { timestamps: true, crud: true },
});
```

**Returns:** `Model` with:

```typescript
interface Model {
  name: string;
  tableName: string;
  fields: FieldDefinition[];
  relationships: Relationship[];
  options: ModelOptions;

  // Schema helpers for validation
  schema: {
    pick(...fields: string[]): Schema;
    omit(...fields: string[]): Schema;
    partial(): Schema;
  };
}
```

---

## `defineRoutes(callback)`

Defines route handlers programmatically.

```typescript
function defineRoutes(
  callback: (router: Router) => void
): RouteDefinition[];
```

**Usage:**

```typescript
import { defineRoutes } from "@web-loom/api-core";

export default defineRoutes((router) => {
  router.get("/api/health", {
    handler: async (ctx) => ctx.json({ status: "ok" }),
  });

  router.post("/api/items", {
    validation: { body: Item.schema.pick("name", "price") },
    middleware: [authenticate],
    handler: async (ctx) => {
      const item = await ctx.db.insert(Item, ctx.body);
      return ctx.json({ item }, 201);
    },
  });
});
```

---

## Router Methods

```typescript
interface Router {
  get(path: string, options: RouteOptions): void;
  post(path: string, options: RouteOptions): void;
  put(path: string, options: RouteOptions): void;
  patch(path: string, options: RouteOptions): void;
  delete(path: string, options: RouteOptions): void;
  options(path: string, options: RouteOptions): void;
}

interface RouteOptions {
  handler: (ctx: RequestContext) => Promise<Response>;
  validation?: {
    body?: Schema;
    query?: Schema;
    params?: Schema;
    headers?: Schema;
  };
  middleware?: Middleware[];
  auth?: boolean | string;
  cache?: { ttl: number; tags?: string[] };
  rateLimit?: { windowMs: number; max: number };
  metadata?: RouteMetadata;
}
```

---

## `RequestContext`

Passed to every route handler and middleware.

```typescript
interface RequestContext {
  // Request data
  request: Request;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;

  // Auth (when authenticated)
  user?: User;
  session?: Session;

  // Adapters
  db: DatabaseAdapter;
  auth: AuthAdapter;
  email: EmailAdapter;

  // Features
  cache: CacheManager;
  webhooks: WebhookManager;
  jobs: JobQueue;

  // Response helpers
  json(data: unknown, status?: number): Response;
  text(data: string, status?: number): Response;
  setCookie(name: string, value: string, options?: CookieOptions): void;
  deleteCookie(name: string): void;

  // Metadata
  metadata: Map<string, unknown>;
}
```

---

## ModelRegistry

```typescript
interface ModelRegistry {
  register(model: ModelDefinition): void;
  unregister(modelName: string): void;
  get(modelName: string): ModelDefinition | undefined;
  getAll(): ModelDefinition[];
  has(modelName: string): boolean;
  getRelationships(modelName: string): Relationship[];
  getDependencies(modelName: string): string[];
  getMetadata(modelName: string): ModelMetadata;
}
```

---

## RouteRegistry

```typescript
interface RouteRegistry {
  register(route: RouteDefinition): void;
  unregister(path: string, method: HTTPMethod): void;
  get(path: string, method: HTTPMethod): RouteDefinition | undefined;
  getAll(): RouteDefinition[];
  getByPath(path: string): RouteDefinition[];
  match(path: string, method: HTTPMethod): RouteMatch | undefined;
}
```

---

## Middleware Type

```typescript
type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>
) => Promise<Response | void>;
```

---

## Type Definitions

### FieldDefinition

```typescript
interface FieldDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "datetime" | "uuid" |
        "enum" | "json" | "array" | "decimal" | "text";
  validation?: ValidationRules;
  database?: DatabaseFieldConfig;
  computed?: boolean;
  transform?: FieldTransform;
  default?: unknown | (() => unknown);
}
```

### ValidationRules

```typescript
interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  format?: "email" | "url" | "uuid";
  enum?: string[];
  items?: SchemaDefinition;
  custom?: (value: unknown) => boolean | string;
}
```

### DatabaseFieldConfig

```typescript
interface DatabaseFieldConfig {
  primaryKey?: boolean;
  unique?: boolean;
  index?: boolean;
  select?: boolean;
  default?: string;
  references?: { model: string; field: string };
}
```

### Relationship

```typescript
interface Relationship {
  type: "hasOne" | "hasMany" | "belongsTo" | "manyToMany";
  model: string;
  foreignKey?: string;
  through?: string;
  cascade?: "cascade" | "restrict" | "set-null";
  eager?: boolean;
}
```

### ModelOptions

```typescript
interface ModelOptions {
  timestamps?: boolean;
  softDelete?: boolean;
  optimisticLocking?: boolean;
  crud?: boolean | CRUDOptions;
  permissions?: Record<string, PermissionConfig>;
}
```

### HTTPMethod

```typescript
type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
```

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### ErrorResponse

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
