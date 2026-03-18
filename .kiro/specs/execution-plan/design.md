# Design: Execution Plan

## Dependency Graph

```
stack-foundation
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
  model-system      routing-system     auth-middleware
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
                          ▼
                   crud-generator
                          │
                          ▼
                  openapi-generator
```

**Rules derived from the graph:**

1. `stack-foundation` has no dependencies — it must be completed first.
2. `model-system`, `routing-system`, and `auth-middleware` all depend only on `stack-foundation` — they can be worked on in parallel once phase 1 is done.
3. `crud-generator` depends on all three phase-2 specs — it cannot start until all of phase 2 is complete.
4. `openapi-generator` depends on `crud-generator` (and transitively everything else) — it is always last.

---

## Why These Boundaries

### Why `model-system` and `routing-system` are parallel

`model-system` defines `defineModel()`, `ModelRegistry`, and the Zod schemas derived from Drizzle tables. It does not import anything from `routing-system`.

`routing-system` defines `defineRoutes()`, route file discovery, `validate()`, and the global error handler. It does not import anything from `model-system`.

They share only types from `stack-foundation` (`WebLoomVariables`, `Application`).

### Why `auth-middleware` is parallel with the other two

`auth-middleware` only needs `WebLoomVariables` (to extend with `user?: AuthUser`) and Hono itself. It has no runtime dependency on `model-system` or `routing-system`.

### Why `crud-generator` cannot be parallelised

It imports:
- `Model<TTable>`, `ModelRegistry`, `serializeModel` — from `model-system`
- `defineRoutes()`, `validate()` — from `routing-system`
- `authenticate`, `requireRole` — from `auth-middleware`

All three must be stable before CRUD handlers can be written.

### Why `openapi-generator` is always last

It imports:
- `ModelRegistry` and Zod schemas — from `model-system`
- `openApiMeta()`, route registry — from `routing-system`
- CRUD path structure — from `crud-generator`

It also registers `/openapi.json` and `/docs` routes on the Hono app, which requires `createApp()` to be fully wired.

---

## Intra-Spec Task Order

Within each spec, some tasks are prerequisites for others. The key dependencies are:

### stack-foundation internal order

```
[1] Delete old adapters/interfaces
    → [2] Define WebLoomVariables + Application types
        → [3] defineConfig() + ConfigurationError
            → [4] Drizzle DB initialisation (multi-driver)
                → [5] createApp() core
                    → [6] start() via @hono/node-server
                    → [7] handleRequest()
                    → [8] shutdown()
                    → [9] Email adapter wiring
        → [10] Deployment adapter packages (uses handleRequest)
[11] Update all tests
```

### model-system internal order

```
[1] Add drizzle-zod dependency
    → [2] Define Model types (ModelMeta, CrudOptions, Model<TTable>)
        → [3] ModelRegistry (register, get, getAll, clear, DuplicateModelError)
            → [4] defineModel() (drizzle-zod, auto-register)
                → [5] Schema overrides
                → [6] Wire ModelRegistry to Application
[7] Serialisation utility (independent)
[8] Tests
```

### routing-system internal order

```
[1] defineRoutes() — needs WebLoomVariables
[2] validate() wrapper around zValidator
[3] filePathToMountPath() utility
    → [4] Route file discovery + mounting
        → [5] Route conflict detection
[6] Global middleware in createApp()
[7] Global error handler
[8] Health check routes
[9] Tests
```

Note: tasks 1–2 and 3–5 are independent tracks; 6–8 all plug into `createApp()`.

### auth-middleware internal order

```
[1] AuthUser type + WebLoomVariables augmentation
    → [2] jwtAuth()
    → [3] sessionAuth()
    → [4] apiKeyAuth()
        → [5] requireRole()
        → [6] requirePermission()
    → [7] csrfProtection()
    → [8] composeAuth()
[9] Tests
```

Tasks 2–8 are independent of each other (all depend only on task 1).

### crud-generator internal order

```
[1] Package setup
    → [2] PK resolver
    → [3] Auth middleware resolver
        → [4] List handler
        → [5] Read handler
        → [6] Create handler
        → [7] Replace handler
        → [8] Patch handler
        → [9] Delete handler
        → [10] Soft delete filter applied to List + Read
            → [11] generateCrudRouter() — assembles handlers + auth
                → [12] Wire into createApp()
[13] Integration tests
```

Handlers 4–10 are independent of each other but all depend on tasks 2 and 3.

### openapi-generator internal order

```
[1] Add dependencies (zod-to-json-schema, openapi-types, etc.)
    → [2] openApiMeta() middleware factory
    → [3] Zod-to-JSON-Schema converter
        → [4] CRUD path items builder (needs model-system + crud-generator structure)
        → [5] Hand-written route path items builder
            → [6] generateOpenApiDocument()
                → [7] Register /openapi.json + /docs routes in createApp()
                    → [8] CLI generate openapi command
                    → [9] CLI generate client command
[10] Tests
```
