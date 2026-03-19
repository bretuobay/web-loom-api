# Requirements: Routing System

## Introduction

This spec defines the routing system where route handlers are written using Hono's native API. The framework provides file-based route discovery (scanning `src/routes/`) and a `defineRoutes()` helper that returns a typed `Hono` router. Validation uses `@hono/zod-validator` directly. There is no bespoke `RequestContext` type — handlers receive Hono's `Context` enriched with typed `WebLoomVariables`.

## Glossary

- **Hono_Router**: A `Hono` instance used as a sub-router, mounted on the main `Hono_App`
- **Route_File**: A TypeScript file in `src/routes/` that exports a default `Hono_Router`
- **Route_Discovery**: The framework process of scanning `src/routes/`, importing route files, and mounting them on the `Hono_App`
- **defineRoutes()**: A helper function whose sole purpose is to return a typed `Hono<{ Variables: WebLoomVariables }>` instance
- **WebLoomVariables**: The Hono variable map providing `c.var.db`, `c.var.email`, and `c.var.user`
- **zValidator**: The `@hono/zod-validator` middleware used for request body, query, and param validation
- **RouteConflict**: Two route files mapping to the same method+path combination

---

## Requirements

### 1. Hono-Native Route Definition

**REQ-RS-001**
The Web_Loom_API shall expose a `defineRoutes()` function from `@web-loom/api-core` that returns `new Hono<{ Variables: WebLoomVariables }>()`.

**REQ-RS-002**
The `defineRoutes()` function shall accept no arguments. Its sole purpose is to provide a typed Hono instance with `WebLoomVariables` pre-applied, eliminating the need for consumers to import and apply the type manually.

**REQ-RS-003**
Route handlers in a `defineRoutes()` router shall access the Drizzle DB as `c.var.db` with full type inference (no casting to `any`).

**REQ-RS-004**
Route handlers in a `defineRoutes()` router shall access the email adapter as `c.var.email` when configured.

**REQ-RS-005**
Route handlers in a `defineRoutes()` router shall use `@hono/zod-validator`'s `zValidator('json', schema)` middleware for body validation, receiving the parsed and typed body via `c.req.valid('json')`.

**REQ-RS-006**
Route handlers in a `defineRoutes()` router shall use `@hono/zod-validator`'s `zValidator('query', schema)` middleware for query parameter validation.

**REQ-RS-007**
Route handlers in a `defineRoutes()` router shall use `@hono/zod-validator`'s `zValidator('param', schema)` middleware for URL parameter validation.

---

### 2. File-Based Route Discovery

**REQ-RS-010**
The Web_Loom_API shall scan the directory specified by `config.routes.dir` (default: `./src/routes`) at application startup and import all `.ts` files as route modules.

**REQ-RS-011**
The Web_Loom_API shall map route file paths to URL mount paths using the following convention:

| File path | Mount path |
|---|---|
| `src/routes/users.ts` | `/users` |
| `src/routes/users/[id].ts` | `/users/:id` |
| `src/routes/posts/[...slug].ts` | `/posts/*` |
| `src/routes/index.ts` | `/` |
| `src/routes/api/v1/health.ts` | `/api/v1/health` |

**REQ-RS-012**
The Web_Loom_API shall expect each route file to export a `Hono` instance as its default export. If a file's default export is not a `Hono` instance, the Web_Loom_API shall throw a `RouteLoadError` identifying the offending file.

**REQ-RS-013**
When route discovery is complete, the Web_Loom_API shall mount each route file's `Hono` instance onto the main `Hono_App` using `app.route(mountPath, router)`.

**REQ-RS-014**
If `config.routes.dir` does not exist, the Web_Loom_API shall start without file-based routes and log a warning. It shall not throw an error.

---

### 3. Route Conflicts

**REQ-RS-020**
When two route files produce the same method and path combination, the Web_Loom_API shall throw a `RouteConflictError` at startup listing both conflicting files and the duplicated path.

**REQ-RS-021**
When a file-based route conflicts with a CRUD-generated route for the same method and path, the file-based route shall take precedence and the CRUD-generated route shall be skipped for that method+path. The Web_Loom_API shall log a warning identifying the override.

---

### 4. Global Middleware Registration

**REQ-RS-030**
The Web_Loom_API shall inject `c.var.db` into every request by registering a global middleware on the `Hono_App` before route discovery.

**REQ-RS-031**
Where an `EmailAdapter` is configured, the Web_Loom_API shall inject `c.var.email` into every request via a global middleware.

**REQ-RS-032**
The Web_Loom_API shall register Hono's built-in `logger()` middleware on the `Hono_App` when `config.observability.logging.enabled` is `true`.

**REQ-RS-033**
The Web_Loom_API shall register Hono's built-in `compress()` middleware when `config.performance.compression` is `true`.

---

### 5. Error Handling

**REQ-RS-040**
The Web_Loom_API shall register a global Hono `onError` handler that formats all unhandled errors into the standard error response shape:
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "...",
    "requestId": "...",
    "timestamp": "..."
  }
}
```

**REQ-RS-041**
When `@hono/zod-validator` produces a validation failure, the Web_Loom_API shall format the Zod error into the standard `VALIDATION_ERROR` response shape with per-field `details`, returning HTTP 400.

**REQ-RS-042**
The Web_Loom_API shall generate a unique `requestId` (UUIDv4) for each request and attach it to the error response and to an `X-Request-Id` response header.

**REQ-RS-043**
While running in production (`NODE_ENV=production`), the Web_Loom_API shall omit stack traces and internal error details from error responses to prevent information leakage.

---

### 6. Health Check

**REQ-RS-050**
The Web_Loom_API shall register a `GET /health` route on the `Hono_App` that returns HTTP 200 with `{ "status": "ok", "timestamp": "<ISO8601>" }`.

**REQ-RS-051**
The Web_Loom_API shall register a `GET /ready` route that performs a database health check and returns HTTP 200 when the database connection is healthy, or HTTP 503 when it is not.
