# Tasks: OpenAPI Generator

## Task List

- [x] 1. Add dependencies to `@web-loom/api-generator-openapi`
  - Add `zod-to-json-schema`, `openapi-types` as runtime dependencies
  - Add `@hono/swagger-ui`, `@scalar/hono-api-reference` as optional dependencies
  - Add `js-yaml` as a dev dependency (for CLI use only)
  - _Requirements: REQ-OG-001_

- [x] 2. Implement `openApiMeta()` middleware factory
  - Create `packages/api-core/src/routing/open-api-meta.ts`
  - Attach `RouteMeta` to the middleware function via a Symbol key
  - Export `openApiMeta()` and `getRouteMeta()` from `packages/api-core/src/index.ts`
  - Define `RouteMeta` interface with all documented fields
  - _Requirements: REQ-OG-030, REQ-OG-031, REQ-OG-032_

- [x] 3. Implement Zod-to-JSON-Schema converter
  - Create `packages/api-generators/openapi/src/zod-to-schema.ts`
  - Uses Zod v4 native `toJSONSchema()` (replaces `zod-to-json-schema` which lacks v4 support)
  - Handles nullable, default, and array schemas natively
  - On conversion failure, returns `{}` (any-type) and emits a `console.warn` (REQ-OG-042)
  - _Requirements: REQ-OG-040, REQ-OG-041, REQ-OG-042_

- [x] 4. Implement CRUD path items builder
  - Create `packages/api-generators/openapi/src/builders/crud-paths.ts`
  - Generates path items for all six operations per model with `crud` enabled
  - Sets correct `summary`, `tags`, `operationId` per operation
  - Adds list query parameters (`page`, `limit`, `sort`, `fields`, `search`)
  - References `insertSchema` for Create and Replace `requestBody`
  - References `updateSchema` for Patch `requestBody`
  - References `selectSchema` for 200 responses
  - Documents standard error responses (400, 401, 403, 409, 500) for each operation
  - _Requirements: REQ-OG-020 through REQ-OG-026_

- [x] 5. Implement hand-written route path items builder
  - Create `packages/api-generators/openapi/src/builders/manual-paths.ts`
  - Accepts `RouteMetaEntry[]` (path + method + RouteMeta)
  - Builds path items from `RouteMeta.request.body`, `.query`, `.params`, and `.responses`
  - Converts Hono `:param` syntax to OpenAPI `{param}` syntax
  - _Requirements: REQ-OG-032, REQ-OG-033_

- [x] 6. Implement `generateOpenApiDocument()`
  - Create `packages/api-generators/openapi/src/generate-openapi.ts`
  - Accepts `models`, `routeMetas`, and `config: OpenApiConfig`
  - Combines CRUD path items + hand-written path items into `paths`
  - Collects all schemas into `components.schemas`
  - Returns a valid OpenAPI 3.1.0 document
  - _Requirements: REQ-OG-010 through REQ-OG-013_

- [x] 7. Register schema and UI serving routes in `createApp()`
  - `setupOpenApiRoutes` in `packages/api-generators/openapi/src/serve-openapi.ts`
  - Registers `GET /openapi.json` returning `generateOpenApiDocument()` as JSON
  - Registers `GET /openapi.yaml` returning YAML via `js-yaml`
  - Registers `GET /docs` with Swagger UI when `config.openapi.ui === 'swagger'`
  - Registers `GET /docs` with Scalar when `config.openapi.ui === 'scalar'`
  - Skips all OpenAPI routes when `config.openapi.enabled === false`
  - `createApp()` accepts `openapiSetup` callback to avoid circular dependency
  - _Requirements: REQ-OG-001 through REQ-OG-005_

- [ ] 8. Implement `generate openapi` CLI command
  - In `packages/api-cli/src/commands/generate-openapi.ts`:
    - Import the user's app via the entry point specified in config or `src/index.ts`
    - Call `generateOpenApiDocument()`
    - Write JSON (default) or YAML (`--format yaml`) to `--output <path>`
    - Overwrite existing files without prompt
  - _Requirements: REQ-OG-050, REQ-OG-051, REQ-OG-052_

- [ ] 9. Implement `generate client` CLI command
  - In `packages/api-cli/src/commands/generate-client.ts`:
    - Read the OpenAPI document from `--input <path>` or default `./openapi.json`
    - Generate a TypeScript fetch client with typed functions per operation
    - Write to `--output <dir>` (default: `./src/client`)
    - Client must use native `fetch` with no runtime dependencies
  - _Requirements: REQ-OG-060, REQ-OG-061, REQ-OG-062_

- [x] 10. Write tests
  - Unit tests for `zodToSchema()`: string, number, object, nullable, optional, default, array
  - Unit tests for CRUD path items builder: operationId naming, requestBody refs, query params, error responses, schema registration
  - Unit tests for `buildManualPathItems`: path conversion, requestBody schema, path syntax
  - Unit tests for `generateOpenApiDocument`: document structure, CRUD inclusion/exclusion, routeMetas, defaults
  - 26 tests total, all passing
