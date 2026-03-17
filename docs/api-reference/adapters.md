# API Reference: Adapter Packages

## @web-loom/api-adapter-hono

HTTP framework adapter using [Hono](https://hono.dev).

### `honoAdapter(options?)`

```typescript
function honoAdapter(options?: HonoAdapterOptions): APIFrameworkAdapter;

interface HonoAdapterOptions {
  basePath?: string;    // URL prefix (e.g., "/api/v1")
  strict?: boolean;     // Strict trailing slash matching
}
```

**Usage:**

```typescript
import { honoAdapter } from "@web-loom/api-adapter-hono";

defineConfig({
  adapters: {
    api: honoAdapter({ basePath: "/api" }),
  },
});
```

**Implements:** `APIFrameworkAdapter`

```typescript
interface APIFrameworkAdapter {
  registerRoute(method: HTTPMethod, path: string, handler: RouteHandler): void;
  registerMiddleware(middleware: Middleware, options?: MiddlewareOptions): void;
  handleRequest(request: Request): Promise<Response>;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}
```

---

## @web-loom/api-adapter-drizzle

Database adapter using [Drizzle ORM](https://orm.drizzle.team) with [Neon](https://neon.tech) serverless Postgres.

### `drizzleAdapter(options?)`

```typescript
function drizzleAdapter(options?: DrizzleAdapterOptions): DatabaseAdapter;

interface DrizzleAdapterOptions {
  driver?: "neon" | "postgres" | "mysql";
  schema?: string;
  logger?: boolean;
}
```

**Usage:**

```typescript
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";

defineConfig({
  adapters: {
    database: drizzleAdapter({ logger: true }),
  },
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 10,
    connectionTimeout: 10_000,
    readReplicas: [process.env.DATABASE_READ_URL!],
  },
});
```

**Implements:** `DatabaseAdapter`

```typescript
interface DatabaseAdapter {
  // Connection lifecycle
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // Raw queries
  query<T>(sql: string, params: unknown[]): Promise<T[]>;
  execute(sql: string, params: unknown[]): Promise<void>;

  // Transactions
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;

  // Query builder
  select<T>(model: ModelDefinition): QueryBuilder<T>;
  insert<T>(model: ModelDefinition, data: T): Promise<T>;
  update<T>(model: ModelDefinition, id: string, data: Partial<T>): Promise<T>;
  delete(model: ModelDefinition, id: string): Promise<void>;

  // Schema management
  createTable(model: ModelDefinition): Promise<void>;
  dropTable(model: ModelDefinition): Promise<void>;
  migrateSchema(migration: Migration): Promise<void>;
}
```

### QueryBuilder

```typescript
interface QueryBuilder<T> {
  where(field: string, op: Operator, value: unknown): QueryBuilder<T>;
  orderBy(field: string, direction?: "asc" | "desc"): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  offset(count: number): QueryBuilder<T>;
  with(relation: string): QueryBuilder<T>;
  first(): Promise<T | null>;
  then(resolve: (rows: T[]) => void): Promise<T[]>;
}

type Operator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "like" | "ilike";
```

**Query examples:**

```typescript
// Select with conditions
const users = await ctx.db
  .select(User)
  .where("role", "=", "admin")
  .orderBy("createdAt", "desc")
  .limit(20);

// Eager-load relationships
const post = await ctx.db
  .select(Post)
  .where("id", "=", postId)
  .with("author")
  .with("comments")
  .first();

// Transaction
await ctx.db.transaction(async (tx) => {
  const user = await tx.insert(User, userData);
  await tx.insert(Post, { ...postData, userId: user.id });
});
```

---

## @web-loom/api-adapter-zod

Validation adapter using [Zod](https://zod.dev).

### `zodAdapter()`

```typescript
function zodAdapter(): ValidationAdapter;
```

**Implements:** `ValidationAdapter`

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

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string[];
  message: string;
  code: string;
}
```

---

## @web-loom/api-adapter-lucia

Authentication adapter using [Lucia](https://lucia-auth.com).

### `luciaAdapter(options?)`

```typescript
function luciaAdapter(options?: LuciaAdapterOptions): AuthAdapter;

interface LuciaAdapterOptions {
  sessionExpiry?: string;    // e.g., "30d", "7d", "24h"
  cookieName?: string;       // Default: "session"
  secureCookies?: boolean;   // Default: true in production
}
```

**Implements:** `AuthAdapter`

```typescript
interface AuthAdapter {
  // Sessions
  createSession(userId: string, attributes?: Record<string, unknown>): Promise<Session>;
  validateSession(sessionId: string): Promise<SessionValidationResult>;
  invalidateSession(sessionId: string): Promise<void>;

  // Users
  createUser(data: UserData): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  updateUser(userId: string, data: Partial<UserData>): Promise<User>;

  // Passwords
  hashPassword(password: string): Promise<string>;
  verifyPassword(hash: string, password: string): Promise<boolean>;

  // OAuth
  getOAuthAuthorizationUrl(provider: string, state: string): string;
  handleOAuthCallback(provider: string, code: string): Promise<User>;

  // API Keys
  createApiKey(userId: string, scopes: string[]): Promise<ApiKey>;
  validateApiKey(key: string): Promise<ApiKeyValidationResult>;
  revokeApiKey(keyId: string): Promise<void>;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  attributes: Record<string, unknown>;
}
```

---

## @web-loom/api-adapter-resend

Email adapter using [Resend](https://resend.com).

### `resendAdapter(options)`

```typescript
function resendAdapter(options: ResendAdapterOptions): EmailAdapter;

interface ResendAdapterOptions {
  apiKey: string;
  from: string;
}
```

**Implements:** `EmailAdapter`

```typescript
interface EmailAdapter {
  send(email: EmailMessage): Promise<EmailResult>;
  sendBatch(emails: EmailMessage[]): Promise<EmailResult[]>;
  sendTemplate(
    templateId: string,
    to: string,
    variables: Record<string, unknown>
  ): Promise<EmailResult>;
  verifyDomain(domain: string): Promise<DomainVerificationResult>;
}

interface EmailMessage {
  from?: string;           // Overrides default sender
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
}

interface EmailResult {
  id: string;
  success: boolean;
  error?: string;
}
```

**Usage in route handlers:**

```typescript
router.post("/api/invite", {
  middleware: [authenticate],
  handler: async (ctx) => {
    await ctx.email.send({
      to: ctx.body.email,
      subject: "You're invited!",
      html: `<p>Hello ${ctx.body.name}, you've been invited.</p>`,
    });
    return ctx.json({ sent: true });
  },
});
```
