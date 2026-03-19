# Requirements: Model System

## Introduction

This spec defines the model system where Drizzle ORM table definitions are the single source of truth for database schema, TypeScript types, and Zod validation schemas. The `defineModel()` function is a thin registration wrapper around a Drizzle table — it does not introduce a proprietary field DSL. `drizzle-zod` derives insert/select/update Zod schemas automatically. The model registry tracks registered models for use by the CRUD generator and OpenAPI generator.

## Glossary

- **Drizzle_Table**: A table definition created with `pgTable()`, `sqliteTable()`, or `mysqlTable()` from `drizzle-orm`
- **Model**: The object returned by `defineModel()`, containing the Drizzle table, derived Zod schemas, and registration metadata
- **Model_Registry**: The runtime registry of all registered models, keyed by model name
- **Insert_Schema**: A Zod schema derived via `createInsertSchema()` from `drizzle-zod`, used for POST/PUT validation
- **Select_Schema**: A Zod schema derived via `createSelectSchema()` from `drizzle-zod`, used for response typing
- **Update_Schema**: `Insert_Schema` with all fields made optional via `.partial()`, used for PATCH validation
- **ModelMeta**: Registration metadata (name, table name, CRUD options, auth options)

---

## Requirements

### 1. Model Definition

**REQ-MS-001**
The Web_Loom_API shall expose a `defineModel<TTable>(table: TTable, meta: ModelMeta): Model<TTable>` function from `@web-loom/api-core`.

**REQ-MS-002**
The `defineModel()` function shall derive `insertSchema` automatically by calling `createInsertSchema(table)` from `drizzle-zod`.

**REQ-MS-003**
The `defineModel()` function shall derive `selectSchema` automatically by calling `createSelectSchema(table)` from `drizzle-zod`.

**REQ-MS-004**
The `defineModel()` function shall derive `updateSchema` as `insertSchema.partial()`, making all insert fields optional for PATCH operations.

**REQ-MS-005**
The `Model<TTable>` returned by `defineModel()` shall expose the following properties with full TypeScript type inference:

- `table`: the original Drizzle table (type `TTable`)
- `insertSchema`: `ZodObject` inferred from the table's insert columns
- `selectSchema`: `ZodObject` inferred from the table's select columns
- `updateSchema`: `ZodObject` with all fields optional
- `meta`: the `ModelMeta` object
- `$inferSelect`: TypeScript type of a selected row (`typeof table.$inferSelect`)
- `$inferInsert`: TypeScript type of an inserted row (`typeof table.$inferInsert`)

**REQ-MS-006**
When `defineModel()` is called, the Web_Loom_API shall automatically register the model with the global `Model_Registry` without requiring an explicit registration call.

**REQ-MS-007**
If a model with the same name is registered twice, the Web_Loom_API shall throw a `DuplicateModelError` identifying the conflicting model name.

---

### 2. ModelMeta

**REQ-MS-010**
The `ModelMeta` interface shall contain:

- `name: string` — PascalCase model name (e.g., `"User"`)
- `crud?: boolean | CrudOptions` — whether to auto-generate CRUD routes (default: `false`)
- `basePath?: string` — URL prefix for CRUD routes (default: `"/" + name.toLowerCase() + "s"`)

**REQ-MS-011**
The `CrudOptions` interface shall contain per-operation auth configuration:

- `list?: CrudOperationOptions`
- `read?: CrudOperationOptions`
- `create?: CrudOperationOptions`
- `update?: CrudOperationOptions`
- `delete?: CrudOperationOptions`

**REQ-MS-012**
The `CrudOperationOptions` interface shall contain:

- `auth?: boolean | string` — `false` for public, `true` for any authenticated user, or a role string (e.g., `"admin"`)
- `cache?: { ttl: number; tags?: string[] }`

---

### 3. Model Registry

**REQ-MS-020**
The Web_Loom_API shall maintain a singleton `ModelRegistry` instance within `@web-loom/api-core`.

**REQ-MS-021**
The `ModelRegistry` shall expose:

- `register(model: Model<AnyTable>): void`
- `get(name: string): Model<AnyTable> | undefined`
- `getAll(): Model<AnyTable>[]`
- `has(name: string): boolean`
- `clear(): void` (for test teardown)

**REQ-MS-022**
The `ModelRegistry` shall be accessible via `app.getModelRegistry()` after `createApp()`.

---

### 4. Zod Schema Customisation

**REQ-MS-030**
The `defineModel()` function shall accept an optional `schemaOverrides` parameter allowing consumers to refine the derived Zod schemas after `drizzle-zod` generation.

**REQ-MS-031**
When `schemaOverrides.insert` is provided, the Web_Loom_API shall merge the provided Zod refinements with the auto-derived `insertSchema` using `.merge()` or `.extend()`.

**REQ-MS-032**
The `schemaOverrides` parameter shall support: `insert`, `select`, and `update` keys, each accepting a function `(schema: ZodObject) => ZodObject`.

---

### 5. Type Exports

**REQ-MS-040**
The `Model<TTable>` type shall be exported from `@web-loom/api-core` so consumers can type function parameters that accept models.

**REQ-MS-041**
The Web_Loom_API shall export a `InferModel<TModel>` utility type that extracts `{ select: ..., insert: ... }` from a `Model<TTable>`, equivalent to `typeof table.$inferSelect` and `typeof table.$inferInsert`.

---

### 6. Serialisation

**REQ-MS-050**
The Web_Loom_API shall serialise model data to JSON with the following type coercions:

- `Date` → ISO 8601 string
- `BigInt` → string
- `Buffer` → base64 string

**REQ-MS-051**
The Web_Loom_API shall apply serialisation coercions in the CRUD generator's response helpers so that individual route handlers do not need to handle them manually.
