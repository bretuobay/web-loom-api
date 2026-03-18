# Tasks: Stack Foundation

## Task List

- [x] 1. Delete removed adapter packages and interfaces
  - Delete `packages/api-adapters/hono/` entirely
  - Delete `packages/api-adapters/drizzle/` entirely
  - Delete `packages/api-adapters/zod/` entirely
  - Delete `packages/api-core/src/interfaces/api-framework-adapter.ts`
  - Delete `packages/api-core/src/interfaces/database-adapter.ts`
  - Delete `packages/api-core/src/interfaces/validation-adapter.ts`
  - Remove all imports of `APIFrameworkAdapter`, `DatabaseAdapter`, `ValidationAdapter`, `QueryBuilder` from other files
  - Update `turbo.json` and root `package.json` to remove the deleted packages
  - _Requirements: REQ-SF-010, REQ-SF-011, REQ-SF-012, REQ-SF-013_

- [x] 2. Define `WebLoomVariables` and `Application` types in `api-core`
  - Create `packages/api-core/src/types.ts` with `WebLoomVariables`, `Application`, and `AnyDrizzleDB` types
  - Export all types from `packages/api-core/src/index.ts`
  - _Requirements: REQ-SF-001, REQ-SF-004, REQ-SF-005, REQ-SF-020, REQ-SF-021, REQ-SF-023_

- [x] 3. Implement `WebLoomConfig` and `defineConfig()`
  - Update `packages/api-core/src/config/types.ts` with the new `WebLoomConfig` shape (remove `adapters` block, add `database.driver`)
  - Update `defineConfig()` to validate `database.url` and `database.driver`
  - Add `ConfigurationError` to `packages/api-core/src/errors/`
  - Throw `ConfigurationError` when `database.url` is empty at startup
  - _Requirements: REQ-SF-030, REQ-SF-031, REQ-SF-032, REQ-SF-033, REQ-SF-034_

- [x] 4. Implement Drizzle DB initialisation with multi-driver support
  - Create `packages/api-core/src/db/create-drizzle-db.ts`
  - Implement factory for `neon-serverless`, `libsql`, and `pg` drivers using dynamic imports
  - Return the appropriate typed Drizzle instance for each driver
  - _Requirements: REQ-SF-002, REQ-SF-005_

- [x] 5. Implement `createApp()` with Hono as the HTTP layer
  - Create `packages/api-core/src/create-app.ts`
  - Initialise Hono app with `WebLoomVariables` type parameter
  - Register global middleware: db injector, email injector, logger (if enabled), compress (if enabled)
  - Register health routes (`/health`, `/ready`)
  - Register global error handler (`onError`)
  - Return the `Application` object
  - _Requirements: REQ-SF-001, REQ-SF-003, REQ-SF-006, REQ-SF-007, REQ-SF-008_

- [x] 6. Implement `Application.start()` using `@hono/node-server`
  - Add `@hono/node-server` as a dependency of `api-core`
  - Implement `start(port?)` to call `serve({ fetch: hono.fetch, port })`
  - _Requirements: REQ-SF-006_

- [x] 7. Implement `Application.handleRequest()` delegating to `hono.fetch`
  - Implement `handleRequest(req: Request): Promise<Response>` as `this.hono.fetch(req)`
  - _Requirements: REQ-SF-007_

- [x] 8. Implement `Application.shutdown()` with graceful teardown
  - Close the database connection pool on shutdown
  - Stop the HTTP server if started via `start()`
  - Implement timeout-bounded shutdown using `Promise.race`
  - _Requirements: REQ-SF-008_

- [x] 9. Retain and wire `EmailAdapter` interface
  - Keep `packages/api-core/src/interfaces/email-adapter.ts` unchanged
  - Throw `ConfigurationError` when `c.var.email` is accessed without configuration
  - Update `@web-loom/api-adapter-resend` to remove any dependency on deleted adapter interfaces
  - _Requirements: REQ-SF-040, REQ-SF-041, REQ-SF-042_

- [x] 10. Update deployment adapter packages
  - Update `@web-loom/api-deployment-cloudflare`: implement `createCloudflareHandler(app)` using `app.handleRequest`
  - Update `@web-loom/api-deployment-vercel`: implement `createVercelHandler(app)` using `app.handleRequest`
  - Update `@web-loom/api-deployment-aws`: implement `createLambdaHandler(app)` with API Gateway v2 payload adaptation
  - _Requirements: REQ-SF-050, REQ-SF-051, REQ-SF-052, REQ-SF-053_

- [x] 11. Update all tests
  - Remove all tests for deleted adapter packages
  - Update `CoreRuntime` tests to use the new `createApp()` API
  - Add integration tests for `createApp()` with a real Drizzle DB (test using `libsql` in-memory)
  - Add tests for `ConfigurationError` on missing `database.url`
