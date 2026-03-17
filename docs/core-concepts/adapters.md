# Adapter System

Web Loom API uses an adapter-based architecture where every major component — HTTP framework, database, validation, authentication, and email — is abstracted behind a standard interface. You pick the implementations you want, and the framework wires them together.

## How Adapters Work

Each adapter type defines a contract (a TypeScript interface). The framework ships default implementations, but you can swap any of them without changing your application code.

```
┌─────────────────────────────────────────────┐
│              Your Application               │
│  (models, routes, middleware, business logic)│
├─────────────────────────────────────────────┤
│              Adapter Interfaces             │
│  API │ Database │ Validation │ Auth │ Email │
├──────┼──────────┼────────────┼──────┼───────┤
│ Hono │ Drizzle  │    Zod     │Lucia │Resend │  ← defaults
│      │ +Neon    │            │      │       │
└──────┴──────────┴────────────┴──────┴───────┘
```

Adapters are configured in `defineConfig()`:

```typescript
import { defineConfig } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";
import { luciaAdapter } from "@web-loom/api-adapter-lucia";
import { resendAdapter } from "@web-loom/api-adapter-resend";

export default defineConfig({
  adapters: {
    api: honoAdapter(),           // required
    database: drizzleAdapter(),   // required
    validation: zodAdapter(),     // required
    auth: luciaAdapter(),         // optional
    email: resendAdapter(),       // optional
  },
  // ...
});
```

## Available Adapters

### API Framework Adapter — `@web-loom/api-adapter-hono`

Handles HTTP routing, request parsing, and response serialization.

| Feature | Detail |
|---------|--------|
| Package | `@web-loom/api-adapter-hono` |
| Default | Yes |
| Size | ~12KB |
| Edge support | Full (Web Standards API) |

```typescript
import { honoAdapter } from "@web-loom/api-adapter-hono";

defineConfig({
  adapters: {
    api: honoAdapter(),
  },
});
```

**Interface:**

```typescript
interface APIFrameworkAdapter {
  registerRoute(method: HTTPMethod, path: string, handler: RouteHandler): void;
  registerMiddleware(middleware: Middleware, options?: MiddlewareOptions): void;
  handleRequest(request: Request): Promise<Response>;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}
```

### Database Adapter — `@web-loom/api-adapter-drizzle`

Manages database connections, queries, transactions, and schema operations.

| Feature | Detail |
|---------|--------|
| Package | `@web-loom/api-adapter-drizzle` |
| Default | Yes (with Neon) |
| Query latency | Sub-10ms from edge |
| Connection pooling | Built-in |

```typescript
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";

defineConfig({
  adapters: {
    database: drizzleAdapter(),
  },
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 10,
    connectionTimeout: 10_000,
    readReplicas: [process.env.DATABASE_READ_URL!],
  },
});
```

**Interface:**

```typescript
interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  query<T>(sql: string, params: unknown[]): Promise<T[]>;
  execute(sql: string, params: unknown[]): Promise<void>;
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
  select<T>(model: ModelDefinition): QueryBuilder<T>;
  insert<T>(model: ModelDefinition, data: T): Promise<T>;
  update<T>(model: ModelDefinition, id: string, data: Partial<T>): Promise<T>;
  delete(model: ModelDefinition, id: string): Promise<void>;
}
```

### Validation Adapter — `@web-loom/api-adapter-zod`

Validates request bodies, query parameters, and path parameters against model schemas.

| Feature | Detail |
|---------|--------|
| Package | `@web-loom/api-adapter-zod` |
| Default | Yes |
| Size | ~8KB |
| TypeScript inference | Full |

```typescript
import { zodAdapter } from "@web-loom/api-adapter-zod";

defineConfig({
  adapters: {
    validation: zodAdapter(),
  },
});
```

**Interface:**

```typescript
interface ValidationAdapter {
  defineSchema<T>(definition: SchemaDefinition): Schema<T>;
  validate<T>(schema: Schema<T>, data: unknown): ValidationResult<T>;
  validateAsync<T>(schema: Schema<T>, data: unknown): Promise<ValidationResult<T>>;
  merge<T, U>(schema1: Schema<T>, schema2: Schema<U>): Schema<T & U>;
  partial<T>(schema: Schema<T>): Schema<Partial<T>>;
  pick<T, K extends keyof T>(schema: Schema<T>, keys: K[]): Schema<Pick<T, K>>;
  infer<T>(schema: Schema<T>): T;
}
```

### Auth Adapter — `@web-loom/api-adapter-lucia`

Session management, password hashing, OAuth2, and API key authentication.

| Feature | Detail |
|---------|--------|
| Package | `@web-loom/api-adapter-lucia` |
| Default | Yes (optional) |
| Size | ~5KB |
| Session storage | Database-backed |

```typescript
import { luciaAdapter } from "@web-loom/api-adapter-lucia";

defineConfig({
  adapters: {
    auth: luciaAdapter({
      sessionExpiry: "30d",
      cookieName: "session",
    }),
  },
});
```

**Interface:**

```typescript
interface AuthAdapter {
  createSession(userId: string, attributes?: Record<string, unknown>): Promise<Session>;
  validateSession(sessionId: string): Promise<SessionValidationResult>;
  invalidateSession(sessionId: string): Promise<void>;
  createUser(data: UserData): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(hash: string, password: string): Promise<boolean>;
  createApiKey(userId: string, scopes: string[]): Promise<ApiKey>;
  validateApiKey(key: string): Promise<ApiKeyValidationResult>;
}
```

### Email Adapter — `@web-loom/api-adapter-resend`

Send transactional emails, templates, and batch messages.

| Feature | Detail |
|---------|--------|
| Package | `@web-loom/api-adapter-resend` |
| Default | Yes (optional) |
| Template support | Built-in |

```typescript
import { resendAdapter } from "@web-loom/api-adapter-resend";

defineConfig({
  adapters: {
    email: resendAdapter({
      apiKey: process.env.RESEND_API_KEY!,
      from: "noreply@example.com",
    }),
  },
});
```

**Interface:**

```typescript
interface EmailAdapter {
  send(email: EmailMessage): Promise<EmailResult>;
  sendBatch(emails: EmailMessage[]): Promise<EmailResult[]>;
  sendTemplate(templateId: string, to: string, variables: Record<string, unknown>): Promise<EmailResult>;
}
```

## Swapping Adapters

Switching an adapter is a config change — your models, routes, and business logic stay the same.

```bash
# CLI shortcut
npx webloom switch database prisma
npx webloom switch validation yup
```

Or update `defineConfig()` manually:

```typescript
// Before: Drizzle + Neon
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";

// After: Prisma
import { prismaAdapter } from "@web-loom/api-adapter-prisma";

defineConfig({
  adapters: {
    database: prismaAdapter(), // swap one line
  },
});
```

## Adapter Initialization Order

The Core Runtime initializes adapters in dependency order:

1. **API Framework** — HTTP routing must be ready first
2. **Database** — Connection pool established
3. **Validation** — Schema compilation
4. **Auth** (lazy) — Initialized on first authenticated request
5. **Email** (lazy) — Initialized on first send

Non-critical adapters (auth, email) are lazy-loaded to minimize cold start time on serverless platforms.

## Building Custom Adapters

See the [Custom Adapter Development](../advanced/custom-adapters.md) guide for implementing your own adapter.
