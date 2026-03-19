# Adapter Simplification Analysis

_Date: 2026-03-18_

---

## Core Question

> Are the adapter abstractions providing value, or are they just indirection layers over libraries that will never actually be swapped?

Short answer: **three of the five adapters should be removed and replaced with direct library use.** Two have genuine justification.

---

## Adapter-by-Adapter Verdict

---

### 1. API Framework Adapter (Hono) — REMOVE

**What it does:** Wraps Hono behind an `APIFrameworkAdapter` interface. Translates Hono's context `c` → Web Loom's `RequestContext` via `createRequestContext()`.

**The realistic alternative list:**

- **Express** — no native Fetch API, no edge support, not viable for the target platforms
- **Fastify** — Node.js only, no Cloudflare Workers or Vercel Edge support
- **ElysiaJS** — Bun-only
- **Itty Router** — minimal, no middleware ecosystem

In the serverless/edge space Hono is the only production-grade choice. There is no realistic swap scenario.

**What the abstraction costs:**

The HonoAdapter wraps every handler with `createRequestContext(c)` which re-parses body, query, and params from Hono's context into a bespoke `RequestContext`. This means you can't use:

- **`@hono/zod-validator`** — Hono's official validation middleware (typed body/query/params at the route level)
- **`hono/rpc`** — Hono's built-in type-safe RPC client generation (end-to-end types without OpenAPI)
- **Hono's typed context variables** (`c.var`, `c.get/set` with typed keys)
- **Any Hono ecosystem middleware** — they all receive `c: Context`, not `RequestContext`

Everything the API adapter provides (request parsing, route registration) is something Hono already does better natively.

**Verdict: Delete `@web-loom/api-adapter-hono` and use Hono directly.**

---

### 2. Database Adapter + Query Builder (Drizzle) — REMOVE

This is the most consequential finding. **The DrizzleAdapter barely uses Drizzle.**

Look at what the implementation actually does in `drizzle-adapter.ts`:

```typescript
// Drizzle is imported and a db instance created...
this._db = drizzle(this.pool);

// ...but then never used. Every operation goes through raw pool:
async insert<T>(model: ModelDefinition, data: T): Promise<T> {
  const fields = Object.keys(data as object);
  const values = Object.values(data as object);
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  return this.query<T>(sql, values);
}
```

And the `DrizzleQueryBuilder`:

```typescript
async execute(): Promise<T[]> {
  let sql = `SELECT * FROM ${this.tableName}`;
  // manually builds WHERE, ORDER BY, LIMIT clauses as strings
}
```

**This is a custom SQL string builder sitting on top of the connection pool, with Drizzle imported but unused.** The problems:

1. **SQL injection risk** — column names come from `Object.keys(data)` with no sanitization. A field named `; DROP TABLE users; --` would execute.
2. **Equality-only filtering** — can't express `>=`, `<=`, `!=`, `LIKE`, `IN`, `IS NULL`
3. **No JOINs** — relationships are defined on models but can never be queried
4. **No aggregations** — COUNT, SUM, GROUP BY impossible
5. **No upserts, CTEs, window functions**
6. **Zero type safety** — field names are `string`, not `keyof T`
7. **All the Drizzle bundle size, none of the Drizzle benefits**

Compare to what Drizzle actually looks like:

```typescript
// Drizzle — fully type-safe, compile-time checked, all SQL operations
const users = await db
  .select()
  .from(users)
  .where(and(gte(users.age, 18), eq(users.status, 'active')))
  .orderBy(desc(users.createdAt))
  .limit(20)
  .offset(page * 20);
```

The field names are typed (not strings), operators are typed, return type is inferred. This is what you lose by wrapping Drizzle in `DatabaseAdapter`.

**The "swappability" claim is also weak for databases:**

Switching from Drizzle to Prisma isn't a config swap — it requires rewriting every schema definition (`.ts` Drizzle tables → Prisma `schema.prisma`), regenerating migrations, and handling completely different migration tooling. The adapter doesn't save you from this work; it just adds a middle layer that prevents you from using either tool properly.

**The Query Builder specifically:**

A custom query builder has essentially zero defensible position in 2026. Drizzle's query builder is better than anything this framework could ship. Kysely, Knex, and Drizzle have already solved this problem comprehensively. Building another one, with less features, worse type safety, and SQL injection risks, is anti-value.

**Verdict: Delete `@web-loom/api-adapter-drizzle` and the `QueryBuilder` interface. Use Drizzle's API directly in route handlers and in generated CRUD code. The Drizzle `db` instance should be the thing on `ctx.db`.**

---

### 3. Validation Adapter (Zod) — REMOVE

**What it does:** Translates a custom `SchemaDefinition` format into Zod schemas, then wraps the Zod schema in `{ _zodSchema: zodSchema }`. Exposes `validate`, `pick`, `partial`, `merge` methods that delegate directly to Zod.

**The wrapper type `Schema<T>` is opaque — type inference is completely broken:**

```typescript
// What the adapter gives you:
const schema = adapter.defineSchema({ name: { type: 'string' } }); // → Schema<unknown>

// What Zod gives you natively:
const schema = z.object({ name: z.string() }); // → ZodObject<{ name: ZodString }>
// And downstream: z.infer<typeof schema> → { name: string }
```

The validation adapter throws away the only thing that makes Zod valuable in TypeScript: type inference at the definition site.

**The SchemaDefinition format is also a subset of Zod:**

```typescript
// Adapter's format — custom DSL, limited
{ type: 'string', format: 'email', minLength: 3 }

// Zod natively:
z.string().email().min(3)
// Full power: transforms, refinements, discriminated unions, branded types, etc.
```

Anything complex (discriminated unions, branded types, `.transform()`, `.superRefine()`, z.lazy for recursive types) is impossible through the adapter's `SchemaDefinition`.

**The swap-to-Yup/Joi argument doesn't hold:**

Zod, Yup, and Joi have fundamentally different validation philosophies:

- Zod: parse-and-transform (returns typed data)
- Yup: cast-and-validate (mutates)
- Joi: plain validation (no TypeScript inference)

Swapping between them requires rewriting all schema definitions regardless of the adapter. The adapter doesn't save any work; it just adds a translation layer that costs type safety.

In the TypeScript serverless ecosystem in 2026, Zod is the unambiguous standard. `drizzle-zod` bridges Drizzle schemas to Zod schemas. `@hono/zod-validator` wires Zod to Hono. The toolchain already converges on Zod.

**Verdict: Delete `@web-loom/api-adapter-zod`. Use Zod directly everywhere. `drizzle-zod` is the bridge from model to validation schema.**

---

### 4. Auth Adapter (Lucia) — KEEP WITH CHANGES

Auth is different. There are genuinely multiple valid strategies:

- **Session-based** (Lucia, Iron Session) — DB-backed, revocable
- **JWT** — stateless, edge-friendly, but not revocable without infrastructure
- **OAuth** — provider delegation (Google, GitHub, etc.)
- **API Keys** — for machine-to-machine calls
- **Multi-tenant** — workspace-scoped sessions

These have meaningfully different security properties and infrastructure requirements, and teams genuinely choose different ones for different projects.

**However, the current `AuthAdapter` interface is too broad.** It mixes session management, OAuth, API keys, and password hashing into one class. The result is a large interface that no single auth strategy implements cleanly.

**Better model:** Provide auth as **Hono middleware** rather than an adapter class. Each strategy is a middleware factory:

```typescript
// JWT auth — stateless, edge-native
app.use('/api/*', jwtAuth({ secret: env.JWT_SECRET }))

// Session auth — DB-backed via Lucia
app.use('/api/*', sessionAuth({ lucia }))

// API key auth
app.use('/api/*', apiKeyAuth({ validate: (key) => db.query... }))
```

This is composable, is consistent with how Hono's ecosystem works, and doesn't require a massive interface.

**Verdict: Keep the concept, remove the class-based adapter. Replace with Hono middleware factories. Lucia can be used directly inside the session middleware.**

---

### 5. Email Adapter (Resend) — KEEP AS-IS

This is the best adapter in the codebase. Email providers are a genuine swap scenario:

- Resend → SendGrid (pricing, deliverability needs)
- Resend → AWS SES (AWS-native shops, cost at scale)
- Resend → Postmark (transactional focused)
- Resend → test mode (CI/testing)

The `EmailAdapter` interface (`send`, `sendBatch`, `sendTemplate`) maps cleanly to what all providers offer. The Resend implementation is solid — it has test mode with `sentEmails` capture, good error handling, clean payload mapping.

Switching email providers is a real maintenance event that happens multiple times over a project's life.

**Verdict: Keep. The `EmailAdapter` abstraction is justified.**

---

## Summary Table

| Adapter                 | Keep?        | Reason                                                                    |
| ----------------------- | ------------ | ------------------------------------------------------------------------- |
| API Framework (Hono)    | **Remove**   | No real swap target in serverless; blocks Hono ecosystem                  |
| Database + QueryBuilder | **Remove**   | Custom SQL builder atop Drizzle; loses type safety, enables SQL injection |
| Validation (Zod)        | **Remove**   | Re-wraps Zod; destroys type inference; Zod is the standard                |
| Auth (Lucia)            | **Redesign** | Concept is right, but class interface is wrong; use Hono middleware       |
| Email (Resend)          | **Keep**     | Genuine swap scenario; clean interface; good implementation               |

---

## What the Revised Architecture Looks Like

The framework's value-add shifts from "adapter plumbing" to **orchestration and generation**:

### Model Definition → Drizzle + drizzle-zod directly

```typescript
// src/models/user.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

// These are derived automatically — one source of truth
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

The framework's `defineModel()` can be a thin wrapper that registers the table with the model registry for CRUD generation — but the Drizzle table IS the model definition.

### Routes → Hono directly

```typescript
// src/routes/users.ts
import { zValidator } from '@hono/zod-validator';
import { insertUserSchema } from '../models/user';

export default defineRoutes((app) => {
  // app IS a Hono app/router — no translation layer
  app.post('/users', zValidator('json', insertUserSchema), async (c) => {
    const data = c.req.valid('json'); // fully typed, no casting
    const user = await c.var.db.insert(users).values(data).returning();
    return c.json(user[0], 201);
  });
});
```

### ctx.db → Actual Drizzle instance

```typescript
// ctx.db is typeof db from drizzle() — not a custom QueryBuilder
const posts = await ctx.db
  .select()
  .from(posts)
  .where(and(eq(posts.userId, ctx.user.id), gte(posts.createdAt, since)))
  .orderBy(desc(posts.createdAt))
  .limit(20);
```

### The framework still provides real value

Even with adapters removed, the framework owns:

1. **CRUD generator** — generates Hono routes from Drizzle tables (the main value proposition)
2. **OpenAPI generator** — generates OpenAPI from Hono routes + Zod schemas
3. **Type-safe client generator** — generates fetch clients from the OpenAPI spec or via `hono/rpc`
4. **File-based route discovery** — scans `src/routes/` and wires to Hono app
5. **Model registry** — tracks registered Drizzle tables for generation
6. **Deployment wrappers** — `export default app` for Cloudflare, `export const handler` for Lambda, etc.
7. **CLI** — scaffolding, `generate crud`, `generate openapi`
8. **Auth middleware** — JWT, session, API key as ready-to-use Hono middleware
9. **Email adapter** — kept as-is

The framework becomes "Hono + Drizzle + Zod with conventions and code generation" — which is honest and powerful. This is analogous to how Next.js is "React with conventions and SSR/SSG infrastructure." Next.js doesn't abstract React; it commits to it.

---

## Packages to Delete

- `@web-loom/api-adapter-hono` — replace with direct Hono usage
- `@web-loom/api-adapter-drizzle` — replace with direct Drizzle usage
- `@web-loom/api-adapter-zod` — replace with direct Zod usage
- `ValidationAdapter` interface in `@web-loom/api-core`
- `DatabaseAdapter` interface in `@web-loom/api-core`
- `APIFrameworkAdapter` interface in `@web-loom/api-core`
- `QueryBuilder` interface in `@web-loom/api-core`

## Packages to Keep / Create

- `@web-loom/api-core` — slimmed down: model registry, route registry, runtime bootstrap
- `@web-loom/api-adapter-resend` — keep as-is ✓
- `@web-loom/api-middleware-auth` — redesign as Hono middleware factories
- `@web-loom/api-generator-crud` — core value, generates Hono routes from Drizzle tables
- `@web-loom/api-generator-openapi` — generates OpenAPI from Hono RPC types or Zod schemas
- `@web-loom/api-deployment-*` — deployment wrappers (these are justified adapter patterns)
- `@web-loom/api-cli` — scaffolding and generation CLI
