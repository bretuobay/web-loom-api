# Tasks: CRUD Generator

## Task List

- [x] 1. Create `@web-loom/api-generator-crud` package
  - Create `packages/api-generators/crud/package.json` with dependencies: `drizzle-orm`, `hono`, `@web-loom/api-core`, `@web-loom/api-middleware-auth`
  - Add to `turbo.json` build pipeline
  - _Requirements: REQ-CG-001_

- [x] 2. Implement primary key resolver
  - Create `packages/api-generators/crud/src/pk-resolver.ts`
  - Use `getTableColumns()` from `drizzle-orm` to find the column with `.primary === true`
  - Throw a descriptive error if no primary key column is found
  - _Requirements: REQ-CG-020, REQ-CG-022_

- [x] 3. Implement auth middleware resolver
  - Create `packages/api-generators/crud/src/auth-resolver.ts`
  - Map `CrudOperationOptions.auth` values to `MiddlewareHandler[]`:
    - `false` / absent → `[]`
    - `true` → `[authenticate]`
    - `string` → `[authenticate, requireRole(role)]`
  - _Requirements: REQ-CG-090, REQ-CG-091, REQ-CG-092_

- [x] 4. Implement the List handler
  - Create `packages/api-generators/crud/src/handlers/list.ts`
  - Parse `page`, `limit`, `sort`, `fields`, `search` from query params with defaults and clamps
  - Implement `buildWhereConditions()` supporting equality and bracketed operators (`[gte]`, `[lte]`, `[like]`, `[in]`)
  - Implement `buildOrderBy()` parsing `-field` (desc) and `field` (asc)
  - Execute paginated query + count query in parallel with `Promise.all`
  - Return paginated response shape with `data` and `pagination`
  - Return 400 for unrecognised sort fields
  - _Requirements: REQ-CG-010 through REQ-CG-015_

- [x] 5. Implement the Read handler
  - Create `packages/api-generators/crud/src/handlers/read.ts`
  - Query by primary key using `db.select().from(table).where(eq(pk, id))`
  - Return 404 with standard error shape if not found
  - Validate `id` type matches primary key column type; return 400 if mismatch
  - _Requirements: REQ-CG-020, REQ-CG-021, REQ-CG-022_

- [x] 6. Implement the Create handler
  - Create `packages/api-generators/crud/src/handlers/create.ts`
  - Use `db.insert(table).values(data).returning()`
  - Return 201 with created record
  - Catch unique constraint violations and return 409
  - Apply timestamp injection when `opts.timestamps` is true
  - _Requirements: REQ-CG-030, REQ-CG-031, REQ-CG-032, REQ-CG-080_

- [x] 7. Implement the Replace handler
  - Create `packages/api-generators/crud/src/handlers/replace.ts`
  - Validate body against `model.insertSchema` (all required fields must be present)
  - Use `db.update(table).set(data).where(eq(pk, id)).returning()`
  - Return 404 if not found
  - Apply `updatedAt` injection when `opts.timestamps` is true
  - _Requirements: REQ-CG-040, REQ-CG-041, REQ-CG-042, REQ-CG-081_

- [x] 8. Implement the Patch handler
  - Create `packages/api-generators/crud/src/handlers/patch.ts`
  - Validate body against `model.updateSchema` (all fields optional)
  - Return 400 if body is empty (no fields provided)
  - Use `db.update(table).set(data).where(eq(pk, id)).returning()`
  - Return 404 if not found
  - Apply `updatedAt` injection when `opts.timestamps` is true
  - _Requirements: REQ-CG-050 through REQ-CG-053, REQ-CG-081_

- [x] 9. Implement the Delete handler
  - Create `packages/api-generators/crud/src/handlers/delete.ts`
  - For hard delete: `db.delete(table).where(eq(pk, id))`
  - For soft delete (`opts.softDelete`): `db.update(table).set({ deletedAt: new Date() }).where(eq(pk, id))`
  - Return 204 on success, 404 if not found, 409 on FK constraint violation
  - _Requirements: REQ-CG-060 through REQ-CG-063, REQ-CG-070_

- [x] 10. Apply soft delete filter to List and Read
  - In List handler: append `isNull(table.deletedAt)` when `opts.softDelete` is true
  - In Read handler: append `isNull(table.deletedAt)` when `opts.softDelete` is true
  - _Requirements: REQ-CG-071_

- [x] 11. Implement `generateCrudRouter()`
  - Create `packages/api-generators/crud/src/generate-crud-router.ts`
  - Compose handlers with auth middleware using `resolveAuthMiddleware()`
  - Register all six routes on a new `Hono` instance
  - Export `generateCrudRouter` from package index
  - _Requirements: REQ-CG-001, REQ-CG-002_

- [x] 12. Wire CRUD generator into `createApp()`
  - In `packages/api-core/src/create-app.ts`, after model registry is populated:
    - Iterate `modelRegistry.getAll()` filtered to models with `crud` enabled
    - Call `generateCrudRouter(model)` for each
    - Mount using `hono.route(model.meta.basePath, router)`
  - Mount before file-based routes so hand-written routes override
  - _Requirements: REQ-CG-001, REQ-CG-003_

- [x] 13. Write integration tests
  - Test all six CRUD operations against an in-memory SQLite database (libsql)
  - Test pagination: page, limit, total, hasNext/hasPrev
  - Test filtering: equality, `[gte]`, `[lte]`, `[like]`, `[in]`
  - Test sorting: ascending, descending, multiple fields, invalid field → 400
  - Test timestamps: `createdAt` and `updatedAt` auto-set
  - Test soft delete: deleted records excluded from list/read, DELETE sets `deletedAt`
  - Test auth: 401 when auth required and no user, 403 when wrong role
  - Test unique constraint → 409 on create
  - Test FK constraint → 409 on delete
