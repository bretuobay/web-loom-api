# @web-loom/api — Gap Analysis

_Date: 2026-03-18_

---

## 1. Framework Quality Assessment

### What's Strong

The framework concept is solid and the vision is coherent. Specific strengths:

- **Adapter pattern is well-defined.** The five adapter interfaces (API, database, validation, auth, email) are clearly typed in `packages/api-core/src/interfaces/` with good JSDoc coverage.
- **PRD is unusually thorough.** Sections covering serverless rationale, market positioning, versioning strategy, and success metrics are production-grade.
- **Documentation is comprehensive.** Every major surface (routing, models, adapters, deployment, testing, security) has a dedicated doc. Getting-started guide is practical.
- **Registry architecture is clean.** `ModelRegistry` and `RouteRegistry` are properly separated with clear CRUD operations.
- **Lifecycle management is correct.** `CoreRuntime` state machine (`uninitialized → initializing → ready → running → shutting_down → stopped`) with timeout-bounded graceful shutdown is production-quality.
- **Niche is real.** The serverless "orchestration layer" positioning is genuine — no existing framework does exactly this at the Hono+Drizzle+Zod tier.

### Overall Assessment

The framework is at **early alpha / architectural prototype stage**. The vision and interfaces are solid, but the implementation is largely mocked stubs with several features explicitly deferred. The docs describe a more complete system than exists in code.

---

## 2. Nearest Equivalent Existing Frameworks

No single framework is a direct equivalent, but the combination of these covers most of the stated goals:

| Comparable Framework | Overlap | Key Difference |
|---|---|---|
| **KeystoneJS 6** | Schema-driven model definition, auto CRUD, adapter-based DB/auth | GraphQL-first, heavy CMS features, not serverless-optimized |
| **Encore.ts** | Serverless-native TypeScript APIs, auto-generated clients, infra-as-code | Infrastructure provisioning scope, not adapter-swappable |
| **RedwoodJS** | Full-stack meta-framework, model-driven (via Prisma), convention over config, CLI generation | Full-stack opinionated (React+GraphQL), single-platform deploy |
| **AdonisJS** | Convention over config, file-based routing, ORM integration, auth built-in | Node.js only, not serverless/edge optimized, not adapter-swappable |
| **Hono + Drizzle (manual)** | Same default stack | No CRUD generation, no adapter abstraction, no CLI, no OpenAPI generation |
| **tRPC** | End-to-end type safety, client generation | RPC not REST, no model-driven DB schema, tightly coupled to specific tools |

**Verdict:** The closest competitor is **KeystoneJS** for the model-driven CRUD angle and **Encore.ts** for the serverless-native angle. Neither does adapter-swappable REST specifically. The niche is real but narrow.

---

## 3. Gaps

Gaps are grouped by severity: **Critical** (blocks core use cases), **Significant** (limits real-world use), **Minor** (polish/completeness).

---

### 3.1 Critical: Core Runtime Uses Mocks, Not Real Adapters

**File:** `packages/api-core/src/runtime/core-runtime.ts:362–514`

`initializeAdapter()` always calls `createMockAdapter()` regardless of what is configured in `defineConfig()`. The comment says _"This will be replaced with actual adapter loading in integration"_. Real adapters (Hono, Drizzle, Zod) cannot currently be loaded through `CoreRuntime`. The framework cannot run a real HTTP server or connect to a real database.

**Impact:** The entire value proposition is blocked.

**Required work:** Dynamic adapter loading from `adapterConfig` — dynamically import the adapter package and invoke its factory function.

---

### 3.2 Critical: CRUD Generation Is a Stub

**File:** `packages/api-core/src/runtime/core-runtime.ts:117–118`

```typescript
// Step 5: CRUD generation (deferred to Task 7.3)
// Will be implemented in a later task
```

Model-driven CRUD (the framework's headline feature) is not implemented. There are no generated `GET /users`, `POST /users`, etc. routes for models with `crud: true`.

**Impact:** The core feature from the PRD and all documentation does not exist yet.

---

### 3.3 Critical: Model Discovery Is a No-Op

**File:** `packages/api-core/src/runtime/core-runtime.ts:537–549`

`discoverModels()` is an explicit placeholder that does nothing. Models defined in `src/models/` are never automatically scanned and registered. The model registry is only populated if the application manually calls `app.getModelRegistry().register(...)`.

**Impact:** Convention-over-configuration and file-based model discovery don't work.

---

### 3.4 Critical: Middleware Registration Is Deferred

**File:** `packages/api-core/src/runtime/core-runtime.ts:121–123`

```typescript
// Step 7: Middleware registration (deferred to Task 7.4)
// Will be implemented in a later task
```

Global middleware (CORS, auth, rate limiting) cannot be applied to the HTTP server. Route-level middleware composition is also not wired.

---

### 3.5 Significant: Schema Mismatch Between Docs and Code

The documented API surface and the actual TypeScript interfaces diverge in several places. This means the docs describe a different system than what the code implements.

| Doc claims | Actual interface |
|---|---|
| `relationship.model: string` | `relationship.target: string` |
| `DatabaseFieldConfig.unique`, `.index`, `.select`, `.references` | Only `columnName`, `columnType`, `indexed`, `primaryKey` exist |
| `ModelOptions.crud`, `.permissions` | Only `timestamps`, `softDelete`, `optimisticLocking` |
| `ModelDefinition.metadata` | Not in the interface |
| `QueryBuilder.where("role", "=", "admin")` (operator-based) | `QueryBuilder.where(conditions: Partial<T>)` (object equality only) |

**Impact:** Any code written against the documented API will not type-check against the actual interfaces.

---

### 3.6 Significant: QueryBuilder Cannot Express Non-Equality Filters

**File:** `packages/api-core/src/interfaces/database-adapter.ts:421–436`

```typescript
interface QueryBuilder<T> {
  where(conditions: Partial<T>): QueryBuilder<T>;
  // ...
}
```

The `where` signature accepts a partial record — only equality conditions are representable. Queries like `.where("dueDate", "<", new Date())` or `.where("age[gte]", 18)` shown in the docs and routing guide cannot be expressed through this interface.

**Required work:** An operator-based overload or a predicate function signature, e.g.:
```typescript
where(field: keyof T, op: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'like' | 'in', value: unknown): QueryBuilder<T>;
```

---

### 3.7 Significant: Transaction Doesn't Include ORM Methods

**File:** `packages/api-core/src/interfaces/database-adapter.ts:287–323`

The `Transaction` interface only exposes `query/execute/commit/rollback` (raw SQL). There are no `insert`, `update`, `delete`, or `select` methods. The docs show:

```typescript
const result = await ctx.db.transaction(async (tx) => {
  const user = await tx.insert(User, userData);
  const post = await tx.insert(Post, { ...postData, userId: user.id });
});
```

This pattern is impossible with the current `Transaction` interface.

---

### 3.8 Significant: Lazy Adapter Loading Is Synchronous

**File:** `packages/api-core/src/runtime/core-runtime.ts:399–413`

`initializeLazyAdapter()` is synchronous but creating adapters for auth/email will require async operations (connecting to stores, loading credentials). `getAdapter<T>()` calls this synchronously, meaning the promise is swallowed and any async initialization errors are lost.

---

### 3.9 Significant: Cache and Jobs Adapters Exist in Context But Not in Adapter System

**Files:** `docs/api-reference/core.md`, `docs/core-concepts/routing.md`

`RequestContext` exposes `ctx.cache: CacheManager`, `ctx.webhooks: WebhookManager`, and `ctx.jobs: JobQueue`. These are referenced throughout the docs as first-class features. However:

- There is no `CacheAdapter`, `WebhookAdapter`, or `JobAdapter` interface in `packages/api-core/src/interfaces/`
- They are not in the `WebLoomConfig.adapters` configuration block
- The adapter initialization order in the docs doesn't include them

**Impact:** Three of the runtime context properties are completely unspecified and unimplemented.

---

### 3.10 Significant: `defineModel` Has No `.schema` Helper

The docs show a model schema composition API used extensively:

```typescript
User.schema.pick("name", "email", "password")
User.schema.pick("name", "email").partial()
```

There is no `schema` property on the `ModelDefinition` interface (or any other Model type). This pattern can't be implemented as shown because the field names are strings (not type-safe), and the relationship between a `ModelDefinition` and a Zod schema is not defined.

**Recommendation:** Either (a) store a Zod schema on the model and expose `.schema.pick()` using Zod's actual API, or (b) use typed field keys via `satisfies` + a builder pattern.

---

### 3.11 Significant: Auth Is Underspecified for OAuth and "owner" Pattern

**Issue 1 — `auth: "owner"` on routes:**
The docs show:
```typescript
crud: {
  update: { auth: "owner" },
  delete: { auth: "admin" },
}
```
There is no specification for how the framework knows which field is the ownership field (e.g., `userId`), or how it queries the record to check ownership before proceeding.

**Issue 2 — OAuth:**
The `AuthAdapter` interface includes `getOAuthAuthorizationUrl` and `handleOAuthCallback`, but the Lucia adapter configuration doesn't show which OAuth providers are supported, how to configure them, or what the callback URL pattern looks like.

**Issue 3 — Lucia v3:**
Lucia v3 (released 2024) is a significant rewrite that deprecated many session patterns. The adapter docs don't specify which Lucia version is targeted.

---

### 3.12 Significant: `webloom-api switch` Understates Migration Complexity

The PRD and docs describe switching databases or API frameworks as a single CLI command. In practice:

- Switching from Drizzle to Prisma requires rewriting the schema (`.ts` Drizzle tables → Prisma `schema.prisma`), regenerating migrations, and changing all raw query escape hatches
- Switching from Hono to Fastify changes the middleware signature model and plugin system
- The CLI "codemods" for these transitions are not designed or documented beyond a mention

**Gap:** There's no specification of what the `webloom-api switch` codemods actually transform, or what the failure modes are.

---

### 3.13 Significant: OpenAPI Generation From Bespoke FieldDefinition

The OpenAPI generator (`@web-loom/api-generator-openapi`) must convert `defineModel` `FieldDefinition` objects to JSON Schema. This is a non-trivial translation, especially for:

- `type: "json"` — requires a nested schema definition
- `type: "decimal"` — no direct JSON Schema equivalent
- `type: "array"` with `items` — must be recursively translated
- Computed fields — should be excluded from write schemas but present in read schemas
- Relationship fields — should generate `$ref` links

No specification exists for this translation, and the `FieldDefinition` in the interface (`type: string`) is too loose to drive reliable generation.

---

### 3.14 Minor: Incorrect Fetch API Usage in Middleware Docs

**File:** `docs/api-reference/middleware.md:233`

```typescript
ctx.request.headers.set("X-Response-Time", `${duration}ms`);
```

`Request.headers` is a read-only `Headers` object in the Fetch API (Web Standards). This will throw at runtime. Response headers should be set on the `Response` object, or the framework needs a mutable response builder in `ctx`.

---

### 3.15 Minor: AI Metadata Exposure Is Not Specified

The PRD (section 11) states: _"The core provides a runtime API that lists all routes, their input/output schemas (in JSON Schema form), and available operations. This can be queried by an agent."_

No endpoint, format, or interface for this is specified or implemented. The `ModelRegistry` and `RouteRegistry` exist at runtime but there's no `/meta` or similar HTTP endpoint exposed. No spec for how an LLM agent would authenticate to or consume this endpoint.

---

### 3.16 Minor: File-Based Routing Conflict Resolution Not Tested at Scale

The docs state: _"If two files map to the same URL path and HTTP method, the Core Runtime terminates with a conflict error at startup."_

`RouteDiscovery` exists but the conflict detection logic is in `RouteRegistry`. There's no specification or test coverage for:
- Same path, different files (one imports the other)
- Index files (`index.ts` at a directory level) and their precedence
- Interaction between auto-generated CRUD routes and hand-written routes for the same path

---

### 3.17 Minor: Multi-Tenancy Not Addressed

SaaS APIs (a major target audience) almost universally require row-level tenant isolation. The PRD lists this as an open question (section 25). There is no `tenantId` concept, no middleware for tenant context, and no guidance on how `defineModel` + CRUD generation would scope queries to a tenant.

---

### 3.18 Minor: Background Jobs and Real-Time Are Explicit Open Questions

The PRD flags WebSocket support and plugin-based job queues (BullMQ, Inngest) as open questions. The docs reference `ctx.jobs: JobQueue` as if it exists. This contradiction should be resolved — either the feature is in scope (and specified) or `ctx.jobs` should be removed from the documented `RequestContext`.

---

## 4. Summary Table

| # | Gap | Severity | Blocking? |
|---|---|---|---|
| 3.1 | Core runtime uses mocks, not real adapters | Critical | Yes — nothing runs |
| 3.2 | CRUD generation is a stub | Critical | Yes — headline feature missing |
| 3.3 | Model discovery is a no-op | Critical | Yes — convention-over-config broken |
| 3.4 | Middleware registration deferred | Critical | Yes — auth/CORS/rate-limit can't be applied |
| 3.5 | Docs/code schema mismatch | Significant | Yes — can't write valid code from docs |
| 3.6 | QueryBuilder only supports equality filters | Significant | Partially — can't express range/LIKE queries |
| 3.7 | Transaction missing ORM methods | Significant | Yes — no type-safe transactions |
| 3.8 | Lazy adapter loading is synchronous | Significant | No — but will cause silent failures |
| 3.9 | Cache/jobs/webhooks adapters unspecified | Significant | No — context properties are dead code |
| 3.10 | `defineModel` has no `.schema` helper | Significant | Yes — validation composition pattern broken |
| 3.11 | Auth "owner" and OAuth underspecified | Significant | Partially |
| 3.12 | `switch` codemods underspecified | Significant | No — DX promise misleading |
| 3.13 | OpenAPI generation from FieldDefinition unspecified | Significant | No — generator can't be built reliably |
| 3.14 | `Request.headers.set()` incorrect in Fetch API | Minor | No — doc bug |
| 3.15 | AI metadata exposure not specified | Minor | No — future feature |
| 3.16 | Route conflict resolution untested at scale | Minor | No |
| 3.17 | Multi-tenancy not addressed | Minor | No |
| 3.18 | Jobs/real-time marked open but referenced in API | Minor | No |

---

## 5. Recommended Priority Order

**Immediate (unblocks a runnable prototype):**
1. Wire real adapter loading in `CoreRuntime.initializeAdapter()` — stop using mocks
2. Implement `QueryBuilder` operator-based `where` overload
3. Add ORM methods to `Transaction` interface
4. Reconcile docs vs code: field names (`model` vs `target`), `DatabaseFieldConfig`, `ModelOptions`
5. Implement `Model.schema.pick()` / `.partial()` — tie to the underlying Zod schema

**Next (completes core feature set):**
6. Implement CRUD generation from model registry
7. Implement model file discovery in `discoverModels()`
8. Wire middleware registration to the API adapter
9. Specify and implement cache/jobs adapter interfaces or remove from `RequestContext`
10. Fix `ctx.request.headers.set()` to use a mutable response context

**Later (fills product gaps):**
11. Specify "owner" auth pattern and implement row-level ownership check
12. Design `webloom-api switch` codemod contracts
13. Specify AI metadata endpoint format
14. Address multi-tenancy in model options or middleware
15. Resolve jobs/WebSocket scope ambiguity
