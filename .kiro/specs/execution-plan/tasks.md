# Tasks: Execution Plan

Specs must be executed in phase order. Within a phase, specs marked **[parallel]** can be
worked on simultaneously by different engineers or agents. A phase is complete only when
every spec in it has all tasks checked off and its test suite passes.

---

## Phase 1 — Foundation (blocking, must complete before anything else)

**Spec: `stack-foundation`**

All other specs import types and functions defined here. Nothing else can be
started until this phase is green.

- [x] SF-1: Delete `packages/api-adapters/hono/`, `packages/api-adapters/drizzle/`, `packages/api-adapters/zod/` and all three interface files from `api-core`
- [x] SF-2: Define `WebLoomVariables`, `Application`, `AnyDrizzleDB` in `packages/api-core/src/types.ts`
- [x] SF-3: Update `WebLoomConfig` shape (remove `adapters` block; add `database.driver`, `routes.dir`, `email`, `openapi`)
- [x] SF-4: Implement `defineConfig()` with `ConfigurationError` on missing `database.url`
- [x] SF-5: Implement multi-driver Drizzle DB initialisation (`neon-serverless` | `libsql` | `pg`)
- [x] SF-6: Implement `createApp()` — Hono app, db injector middleware, logger, compress, health routes, error handler
- [x] SF-7: Implement `Application.start()` via `@hono/node-server`
- [x] SF-8: Implement `Application.handleRequest()` delegating to `hono.fetch`
- [x] SF-9: Implement `Application.shutdown()` with graceful teardown and timeout
- [x] SF-10: Wire `EmailAdapter` as context variable; throw `ConfigurationError` on unset access
- [x] SF-11: Update `@web-loom/api-deployment-cloudflare`, `-vercel`, `-aws` to use `app.handleRequest()`
- [x] SF-12: Pass all `api-core` tests; confirm zero imports of deleted adapter interfaces

**Gate:** `createApp()` starts a Hono server, injects `c.var.db` (real Drizzle instance), and returns an `Application`. All three deployment adapters compile.

---

## Phase 2 — Core Primitives (parallel, all must complete before Phase 3)

These three specs share only `stack-foundation` types. They have no dependency on each other.

---

### 2A — `model-system` **[parallel]**

- [x] MS-1: Add `drizzle-zod` to `api-core` dependencies
- [x] MS-2: Define `ModelMeta`, `CrudOptions`, `CrudOperationOptions`, `SchemaOverrides`, `Model<TTable>`, `InferModel<TModel>` types
- [x] MS-3: Implement `ModelRegistry` with `DuplicateModelError`
- [x] MS-4: Implement `defineModel()` — calls `createInsertSchema`, `createSelectSchema`, derives `updateSchema`, auto-registers
- [x] MS-5: Implement schema overrides (`insert`, `select`, `update` transform functions)
- [x] MS-6: Expose `app.getModelRegistry()` on `Application`
- [x] MS-7: Implement `serializeModel()` (Date, BigInt, Buffer coercions)
- [x] MS-8: Pass all model-system unit tests

**Gate:** `defineModel(pgTable(...), { name: 'User', crud: true })` returns a `Model<TTable>` with correctly typed `insertSchema`, `selectSchema`, `updateSchema`. Double-registration throws `DuplicateModelError`.

---

### 2B — `routing-system` **[parallel]**

- [x] RS-1: Implement `defineRoutes()` returning `new Hono<{ Variables: WebLoomVariables }>()`
- [x] RS-2: Implement `validate(target, schema)` wrapping `@hono/zod-validator` with standard error formatting and `requestId`
- [x] RS-3: Implement `filePathToMountPath(filePath, baseDir)` for all path conventions
- [x] RS-4: Implement route file discovery — scan dir, import files, validate default export is `Hono`, mount
- [x] RS-5: Implement `RouteConflictError` and conflict detection; CRUD-vs-file-based override warning
- [x] RS-6: Register global middleware in `createApp()` (db injector, email injector, logger, compress)
- [x] RS-7: Implement global `onError` handler with standard error shapes and `X-Request-Id` header
- [x] RS-8: Register `/health` and `/ready` routes in `createApp()`
- [x] RS-9: Pass all routing-system unit and integration tests

**Gate:** A route file exporting `defineRoutes()` is discovered, mounted, and responds correctly. `validate('json', schema)` returns a structured 400 on invalid input. `/health` returns 200.

---

### 2C — `auth-middleware` **[parallel]**

- [x] AM-1: Define `AuthUser` interface; augment `WebLoomVariables` with `user?: AuthUser`
- [x] AM-2: Implement `jwtAuth(options)` using `hono/jwt`; support `optional` flag, `iss`/`aud` validation, custom `getUser`
- [x] AM-3: Implement `sessionAuth(options)` with Lucia integration and cookie refresh
- [x] AM-4: Implement `apiKeyAuth(options)` with `X-API-Key` and `Authorization: Bearer` fallback
- [x] AM-5: Implement `requireRole(role)` and `requirePermission(permission)` guards
- [x] AM-6: Implement `csrfProtection()` for session-based flows
- [x] AM-7: Implement `composeAuth(...middlewares)` first-success multi-strategy helper
- [x] AM-8: Pass all auth-middleware unit and integration tests

**Gate:** `app.use('/api/*', jwtAuth({ secret }))` protects routes. `requireRole('admin')` returns 403 for non-admin users. `composeAuth(jwtAuth(...), apiKeyAuth(...))` accepts either credential type.

---

## Phase 3 — CRUD Generation (sequential, requires all of Phase 2)

**Spec: `crud-generator`**

Depends on `model-system` (Model types, registry), `routing-system` (Hono router, validate), and `auth-middleware` (authenticate, requireRole).

- [ ] CG-1: Create `@web-loom/api-generator-crud` package with correct inter-package dependencies
- [ ] CG-2: Implement `getPrimaryKeyColumn(table)` using `getTableColumns()` from `drizzle-orm`
- [ ] CG-3: Implement `resolveAuthMiddleware(opts)` mapping `CrudOperationOptions.auth` to middleware array
- [ ] CG-4: Implement List handler — pagination, equality + operator filtering (`[gte]`, `[lte]`, `[like]`, `[in]`), sort, parallel count query
- [ ] CG-5: Implement Read handler — query by PK, 404 on missing, PK type validation
- [ ] CG-6: Implement Create handler — `zValidator` body, `.returning()`, 409 on unique constraint, timestamp injection
- [ ] CG-7: Implement Replace handler — full insert schema validation, update by PK, 404 on missing
- [ ] CG-8: Implement Patch handler — update schema (all optional), 400 on empty body, update by PK
- [ ] CG-9: Implement Delete handler — hard delete or soft delete (`deletedAt`), 204 on success, 409 on FK violation
- [ ] CG-10: Apply soft-delete `isNull(table.deletedAt)` filter to List and Read handlers
- [ ] CG-11: Implement `generateCrudRouter(model)` composing all handlers with auth middleware
- [ ] CG-12: Mount generated CRUD routers in `createApp()` before file-based routes
- [ ] CG-13: Pass all CRUD generator integration tests (libsql in-memory)

**Gate:** A model with `crud: true` gets all six endpoints. Pagination, filtering, sorting work. Auth options (`auth: true`, `auth: 'admin'`) produce correct 401/403 responses. Soft delete hides records from list/read.

---

## Phase 4 — OpenAPI Generation (sequential, requires Phase 3)

**Spec: `openapi-generator`**

Depends on all previous phases.

- [x] OG-1: Add `zod-to-json-schema`, `openapi-types`, `@hono/swagger-ui`, `@scalar/hono-api-reference` dependencies
- [x] OG-2: Implement `openApiMeta(meta)` middleware factory (attaches metadata via Symbol, no request-path effect)
- [x] OG-3: Implement `zodToSchema(schema, name, schemas)` with nullable/default handling and graceful fallback
- [x] OG-4: Implement CRUD path items builder — 6 operations per model, correct `requestBody` refs, query params, error responses
- [x] OG-5: Implement hand-written path items builder from `openApiMeta()` annotations
- [x] OG-6: Implement `generateOpenApiDocument(models, routeMetas, config)` producing a valid OpenAPI 3.1 document
- [x] OG-7: Register `/openapi.json`, `/openapi.yaml`, and `/docs` (Swagger or Scalar) in `createApp()`; skip when `config.openapi.enabled === false`
- [ ] OG-8: Implement `webloom generate openapi` CLI command with `--output` and `--format` flags
- [ ] OG-9: Implement `webloom generate client` CLI command producing a native-fetch TypeScript client
- [x] OG-10: Pass all OpenAPI generator tests; validate output against OpenAPI 3.1 schema

**Gate:** `GET /openapi.json` returns a valid OpenAPI 3.1 document listing all CRUD and annotated hand-written routes. `webloom generate openapi` writes the file. `webloom generate client` produces a typed TypeScript client.

---

## Phase Summary

| Phase | Spec(s) | Can start after | Parallelisable |
|---|---|---|---|
| 1 | `stack-foundation` | — (first) | No |
| 2A | `model-system` | Phase 1 complete | Yes (with 2B, 2C) |
| 2B | `routing-system` | Phase 1 complete | Yes (with 2A, 2C) |
| 2C | `auth-middleware` | Phase 1 complete | Yes (with 2A, 2B) |
| 3 | `crud-generator` | Phase 2 complete | No |
| 4 | `openapi-generator` | Phase 3 complete | No |

## Estimated Parallelism

With 3 engineers or agents available, the minimum sequential work is:
- Phase 1 (SF)
- Phase 2 (2A + 2B + 2C in parallel)
- Phase 3 (CG)
- Phase 4 (OG)

Total: **4 sequential milestones**, regardless of team size.

With 1 engineer, the recommended linear order is:
**SF → MS → RS → AM → CG → OG**

`model-system` before `routing-system` is recommended (not required) because the CRUD generator consumes model types more heavily than route types, and getting the model shape right early avoids rework in CG.
