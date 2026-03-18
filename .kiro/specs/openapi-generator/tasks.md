# Tasks: OpenAPI Generator

## Task List

- [ ] 1. Add dependencies to `@web-loom/api-generator-openapi`
  - Add `zod-to-json-schema`, `openapi-types` as runtime dependencies
  - Add `@hono/swagger-ui`, `@scalar/hono-api-reference` as optional dependencies
  - Add `js-yaml` as a dev dependency (for CLI use only)
  - _Requirements: REQ-OG-001_

- [ ] 2. Implement `openApiMeta()` middleware factory
  - Create `packages/api-core/src/routing/open-api-meta.ts`
  - Attach `RouteMeta` to the middleware function via a Symbol key
  - Export `openApiMeta()` and `getRouteMeta()` from `packages/api-core/src/index.ts`
  - Define `RouteMeta` interface with all documented fields
  - _Requirements: REQ-OG-030, REQ-OG-031, REQ-OG-032_

- [ ] 3. Implement Zod-to-JSON-Schema converter
  - Create `packages/api-generators/openapi/src/zod-to-schema.ts`
  - Call `zodToJsonSchema(schema, { target: 'openApi3' })` from `zod-to-json-schema`
  - Handle `ZodNullable` as `nullable: true` in JSON Schema (REQ-OG-041)
  - Handle `ZodDefault` by preserving `default` in the JSON Schema output (REQ-OG-041)
  - On conversion failure, return `{}` (any-type) and emit a `console.warn` with schema name (REQ-OG-042)
  - _Requirements: REQ-OG-040, REQ-OG-041, REQ-OG-042_

- [ ] 4. Implement CRUD path items builder
  - Create `packages/api-generators/openapi/src/builders/crud-paths.ts`
  - For each model with `crud` enabled, generate path items for all six operations
  - Set correct `summary`, `tags`, `operationId` per operation
  - Add list query parameters (`page`, `limit`, `sort`, `fields`, `search`) for the List operation
  - Reference `insertSchema` for Create and Replace `requestBody`
  - Reference `updateSchema` for Patch `requestBody`
  - Reference `selectSchema` for 200 responses
  - Document standard error responses (400, 401, 403, 404, 409, 500) for each operation
  - _Requirements: REQ-OG-020 through REQ-OG-026_

- [ ] 5. Implement hand-written route path items builder
  - Create `packages/api-generators/openapi/src/builders/manual-paths.ts`
  - Accept `RouteMetaEntry[]` (path + method + RouteMeta)
  - Build path items from `RouteMeta.request.body`, `.query`, `.params`, and `.responses`
  - Skip routes without `openApiMeta()` attached
  - _Requirements: REQ-OG-032, REQ-OG-033_

- [ ] 6. Implement `generateOpenApiDocument()`
  - Create `packages/api-generators/openapi/src/generate-openapi.ts`
  - Accept `models`, `routeMetas`, and `config: OpenApiConfig`
  - Combine CRUD path items + hand-written path items into `paths`
  - Collect all schemas into `components.schemas`
  - Return a valid `OpenAPIV3_1.Document`
  - _Requirements: REQ-OG-010 through REQ-OG-013_

- [ ] 7. Register schema and UI serving routes in `createApp()`
  - Register `GET /openapi.json` returning `generateOpenApiDocument()` result as JSON
  - Register `GET /openapi.yaml` returning YAML when `js-yaml` is available
  - Register `GET /docs` with Swagger UI when `config.openapi.ui === 'swagger'`
  - Register `GET /docs` with Scalar when `config.openapi.ui === 'scalar'`
  - Skip all OpenAPI routes when `config.openapi.enabled === false`
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

- [ ] 10. Write tests
  - Unit test `zodToSchema()`: Zod string, number, object, nullable, optional, default, array
  - Unit test CRUD path items builder: verify operationId naming, requestBody refs, query params
  - Integration test: start a test app with two models and two hand-written routes; call `GET /openapi.json`; validate against OpenAPI 3.1 schema
  - Integration test: verify Swagger UI serves at `/docs` when enabled
