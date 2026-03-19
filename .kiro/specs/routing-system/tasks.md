# Tasks: Routing System

## Task List

- [x] 1. Implement `defineRoutes()`
  - Create `packages/api-core/src/routing/define-routes.ts`
  - Return `new Hono<{ Variables: WebLoomVariables }>()`
  - Export from `packages/api-core/src/index.ts`
  - _Requirements: REQ-RS-001, REQ-RS-002_

- [x] 2. Implement the `validate()` wrapper around `@hono/zod-validator`
  - Create `packages/api-core/src/routing/validate.ts`
  - Wrap `zValidator` to format Zod errors into the standard `VALIDATION_ERROR` shape
  - Include `requestId` (UUIDv4) in error response
  - Export `validate` from `packages/api-core/src/index.ts`
  - _Requirements: REQ-RS-005, REQ-RS-006, REQ-RS-007, REQ-RS-041, REQ-RS-042_

- [x] 3. Implement file path → mount path conversion
  - Create `packages/api-core/src/routing/path-utils.ts`
  - Implement `filePathToMountPath(filePath, baseDir): string`
  - Handle: flat files, `index.ts`, `[param]` dynamic segments, `[...param]` catch-alls, nested directories
  - Write unit tests covering all path conventions from the requirements table
  - _Requirements: REQ-RS-011_

- [x] 4. Implement route file discovery and mounting
  - Create `packages/api-core/src/routing/route-discovery.ts`
  - Recursively scan `config.routes.dir` for `.ts` files
  - Dynamically import each file and validate its default export is a `Hono` instance
  - Throw `RouteLoadError` if default export is not a `Hono` instance
  - Mount each router using `mainApp.route(mountPath, router)`
  - Log a warning (not error) if `config.routes.dir` does not exist
  - _Requirements: REQ-RS-010, REQ-RS-012, REQ-RS-013, REQ-RS-014_

- [x] 5. Implement route conflict detection
  - After all routers are mounted, compare registered method+path combinations
  - Throw `RouteConflictError` when two files register the same method+path
  - When a file-based route shadows a CRUD-generated route, log a warning and skip the CRUD route for that method+path
  - _Requirements: REQ-RS-020, REQ-RS-021_

- [x] 6. Implement global middleware in `createApp()`
  - Register db injector middleware (`c.set('db', db)`) before route discovery
  - Register email injector middleware conditionally
  - Register Hono's `logger()` when `config.observability.logging.enabled !== false`
  - Register Hono's `compress()` when `config.performance.compression !== false`
  - _Requirements: REQ-RS-030, REQ-RS-031, REQ-RS-032, REQ-RS-033_

- [x] 7. Implement global error handler
  - Create `packages/api-core/src/routing/error-handler.ts`
  - Map `NotFoundError` → 404, `ConflictError` → 409, `ConfigurationError` → 500 (masked in prod)
  - Add UUIDv4 `requestId` to all error responses and `X-Request-Id` response header
  - Suppress stack traces in `NODE_ENV=production`
  - Register with `hono.onError()` in `createApp()`
  - _Requirements: REQ-RS-040, REQ-RS-041, REQ-RS-042, REQ-RS-043_

- [x] 8. Register health check routes
  - Register `GET /health` returning `{ status: 'ok', timestamp }` in `createApp()`
  - Register `GET /ready` performing a DB health check and returning 200 or 503
  - _Requirements: REQ-RS-050, REQ-RS-051_

- [x] 9. Write tests
  - Unit test `filePathToMountPath()` for all path conventions
  - Integration test: `defineRoutes()` router with `validate('json', schema)` validates and rejects requests correctly
  - Integration test: health check endpoints return expected responses
  - Integration test: error handler formats errors into the standard shape
  - Integration test: route discovery mounts two route files and both respond correctly
