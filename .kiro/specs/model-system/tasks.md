# Tasks: Model System

## Task List

- [x] 1. Add `drizzle-zod` as a dependency of `api-core`
  - Add `drizzle-zod` to `packages/api-core/package.json`
  - Add `zod` as a peer dependency
  - _Requirements: REQ-MS-002, REQ-MS-003_

- [x] 2. Define model types
  - Create `packages/api-core/src/models/types.ts` with:
    - `CrudOperationOptions`
    - `CrudOptions`
    - `ModelMeta`
    - `SchemaOverrides`
    - `Model<TTable>`
    - `InferModel<TModel>`
  - Export all types from `packages/api-core/src/index.ts`
  - _Requirements: REQ-MS-005, REQ-MS-010, REQ-MS-011, REQ-MS-012, REQ-MS-040, REQ-MS-041_

- [x] 3. Implement `ModelRegistry`
  - Create `packages/api-core/src/models/registry.ts` with the `ModelRegistry` class
  - Export the singleton `modelRegistry` instance
  - Implement `register`, `get`, `getAll`, `has`, `clear`
  - Throw `DuplicateModelError` on double registration
  - Create `DuplicateModelError` in `packages/api-core/src/errors/`
  - _Requirements: REQ-MS-020, REQ-MS-021, REQ-MS-007_

- [x] 4. Implement `defineModel()`
  - Create `packages/api-core/src/models/define-model.ts`
  - Call `createInsertSchema(table)` from `drizzle-zod` for `insertSchema`
  - Call `createSelectSchema(table)` from `drizzle-zod` for `selectSchema`
  - Derive `updateSchema = insertSchema.partial()`
  - Apply `schemaOverrides` functions if provided
  - Set `meta.basePath` default to `'/' + name.toLowerCase() + 's'`
  - Auto-register with `modelRegistry`
  - Return typed `Model<TTable>` object
  - Export `defineModel` from `packages/api-core/src/index.ts`
  - _Requirements: REQ-MS-001, REQ-MS-002, REQ-MS-003, REQ-MS-004, REQ-MS-005, REQ-MS-006, REQ-MS-010_

- [x] 5. Implement schema overrides
  - Accept optional third argument `overrides?: SchemaOverrides` in `defineModel()`
  - Apply `overrides.insert(insertSchema)` after `createInsertSchema` if provided
  - Apply `overrides.select(selectSchema)` after `createSelectSchema` if provided
  - Apply `overrides.update(updateSchema)` after `.partial()` if provided
  - _Requirements: REQ-MS-030, REQ-MS-031, REQ-MS-032_

- [x] 6. Wire `ModelRegistry` to `Application`
  - Expose `app.getModelRegistry()` returning the singleton `modelRegistry`
  - _Requirements: REQ-MS-022_

- [x] 7. Implement serialisation utility
  - Create `packages/api-core/src/models/serialize.ts` with `serializeModel(data)`
  - Handle `Date` → ISO 8601, `BigInt` → string, `Buffer` → base64
  - Handle nested objects and arrays recursively
  - Export from `packages/api-core/src/index.ts`
  - _Requirements: REQ-MS-050, REQ-MS-051_

- [x] 8. Write unit tests for model system
  - Test `defineModel()` with a `pgTable` and `sqliteTable`
  - Assert `insertSchema`, `selectSchema`, `updateSchema` are correctly derived Zod schemas
  - Test `DuplicateModelError` on double `defineModel()` for same name
  - Test `schemaOverrides` applied correctly
  - Test `ModelRegistry.clear()` for test isolation
  - Test `serializeModel()` with Date, BigInt, Buffer, nested objects
