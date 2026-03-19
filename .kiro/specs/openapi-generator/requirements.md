# Requirements: OpenAPI Generator

## Introduction

This spec defines automatic OpenAPI 3.1 specification generation from registered Hono routes and Zod schemas. The generator introspects the model registry (for CRUD routes) and route metadata annotations (for hand-written routes) to produce a complete, accurate OpenAPI document. The spec is served at a configurable endpoint and can also be written to disk via the CLI.

## Glossary

- **OpenAPI_Generator**: The `@web-loom/api-generator-openapi` package
- **OpenAPI_Document**: A valid OpenAPI 3.1 JSON/YAML document
- **Zod_To_JSON_Schema**: The conversion of a Zod schema to a JSON Schema object (via `zod-to-json-schema` or equivalent)
- **Route_Metadata**: Optional annotations attached to a route definition that provide description, tags, and response schemas
- **Schema_Registry**: A map of JSON Schema `$ref` components built during OpenAPI generation to avoid duplication
- **openApiMeta()**: A Hono middleware factory that attaches `Route_Metadata` to a route without affecting request handling

---

## Requirements

### 1. Schema Endpoint

**REQ-OG-001**
The Web_Loom_API shall register a `GET /openapi.json` route on the `Hono_App` that returns the `OpenAPI_Document` as `application/json`.

**REQ-OG-002**
The Web_Loom_API shall register a `GET /openapi.yaml` route that returns the `OpenAPI_Document` serialised as YAML with `Content-Type: text/yaml`.

**REQ-OG-003**
When `config.openapi.ui` is `'swagger'`, the Web_Loom_API shall serve Swagger UI at `GET /docs`.

**REQ-OG-004**
When `config.openapi.ui` is `'scalar'`, the Web_Loom_API shall serve Scalar UI at `GET /docs`.

**REQ-OG-005**
When `config.openapi.enabled` is `false`, the Web_Loom_API shall not register any OpenAPI or documentation routes.

---

### 2. Document Structure

**REQ-OG-010**
The `OpenAPI_Document` shall comply with the OpenAPI 3.1.0 specification.

**REQ-OG-011**
The `OpenAPI_Document` shall populate the `info` object from `config.openapi.info`: `title`, `version`, `description` (optional), and `contact` (optional).

**REQ-OG-012**
The `OpenAPI_Document` shall populate `servers` from `config.openapi.servers`, defaulting to `[{ url: '/' }]`.

**REQ-OG-013**
The `OpenAPI_Document` shall include all reusable Zod-derived JSON Schemas under `components.schemas`, referenced via `$ref` from path item operation definitions.

---

### 3. CRUD Route Generation

**REQ-OG-020**
For each model registered in the `Model_Registry` with `crud` enabled, the OpenAPI generator shall produce path items for all six CRUD operations.

**REQ-OG-021**
For each CRUD operation, the generator shall produce:
- `summary` derived from the operation name and model name (e.g., `"List Users"`, `"Create User"`)
- `tags` set to `[model.meta.name]`
- `operationId` set to `"<operation><ModelName>"` (e.g., `"listUser"`, `"createUser"`)

**REQ-OG-022**
The `Create_Route` and `Replace_Route` path items shall define a `requestBody` with `content["application/json"].schema` referencing the model's `Insert_Schema` converted to JSON Schema.

**REQ-OG-023**
The `Patch_Route` path item shall define a `requestBody` referencing the model's `Update_Schema` (all fields optional).

**REQ-OG-024**
The `List_Route` path item shall define all accepted query parameters (`page`, `limit`, `sort`, `fields`, `search`) as `in: query` parameters with their types and descriptions.

**REQ-OG-025**
The `Read_Route`, `Replace_Route`, `Patch_Route`, and `Delete_Route` path items shall define the `id` path parameter with its type derived from the `Primary_Key_Column`'s Drizzle type.

**REQ-OG-026**
All CRUD operations shall document their standard error responses: `400` (validation error), `401` (unauthorized), `403` (forbidden), `404` (not found), `409` (conflict), `500` (internal error).

---

### 4. Hand-Written Route Metadata

**REQ-OG-030**
The Web_Loom_API shall expose an `openApiMeta(meta: RouteMeta)` middleware factory from `@web-loom/api-core` that attaches metadata to a route for OpenAPI generation.

**REQ-OG-031**
The `RouteMeta` interface shall contain:
- `summary?: string`
- `description?: string`
- `tags?: string[]`
- `operationId?: string`
- `request?: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }`
- `responses?: Record<number, { description: string; schema?: ZodSchema }>`
- `deprecated?: boolean`

**REQ-OG-032**
When `openApiMeta()` is used on a route, the OpenAPI generator shall include that route in the `OpenAPI_Document` with the provided metadata. Without `openApiMeta()`, hand-written routes are excluded from the document.

**REQ-OG-033**
When `RouteMeta.request.body` is a Zod schema, the generator shall convert it to JSON Schema via `zod-to-json-schema` and add it to `components.schemas` using the schema's `_def.description` or the `operationId` as the key.

---

### 5. Zod-to-JSON-Schema Conversion

**REQ-OG-040**
The OpenAPI generator shall convert Zod schemas to JSON Schema using `zod-to-json-schema` with the `target: 'openapi3'` option.

**REQ-OG-041**
The generator shall convert `drizzle-zod`-derived schemas correctly, including `ZodNullable` columns (nullable in OpenAPI) and `ZodDefault` columns (with `default` in the JSON Schema).

**REQ-OG-042**
If a Zod schema cannot be converted to JSON Schema (e.g., uses `.refine()` with no description), the generator shall substitute `{}` (any-type) and emit a warning log identifying the unconvertible schema and route.

---

### 6. CLI Generation

**REQ-OG-050**
The `@web-loom/api-cli` shall expose a `generate openapi` command that imports the application, runs the OpenAPI generator, and writes the result to `--output <path>` (default: `./openapi.json`).

**REQ-OG-051**
When `--format yaml` is passed to `generate openapi`, the CLI shall write the document as YAML.

**REQ-OG-052**
When `generate openapi` is run and the output file already exists, the CLI shall overwrite it and print the output path.

---

### 7. Client Generation

**REQ-OG-060**
The `@web-loom/api-cli` shall expose a `generate client` command that reads the `OpenAPI_Document` and generates a type-safe TypeScript fetch client.

**REQ-OG-061**
Each operation in the `OpenAPI_Document` shall produce a typed async function in the generated client with request and response types inferred from the OpenAPI schemas.

**REQ-OG-062**
The generated client shall use the native `fetch` API with no runtime dependencies, making it usable in browsers, Node.js, and edge runtimes.
