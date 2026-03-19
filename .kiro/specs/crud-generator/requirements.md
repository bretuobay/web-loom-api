# Requirements: CRUD Generator

## Introduction

This spec defines automatic CRUD route generation from registered Drizzle models. When a model is registered with `crud: true` (or `CrudOptions`), the CRUD generator produces six Hono route handlers (list, read, create, update, patch, delete) using Drizzle's query builder directly. Generated routes are mounted on the main `Hono_App` before file-based routes so that hand-written routes can override them per REQ-RS-021.

## Glossary

- **CRUD_Generator**: The `@web-loom/api-generator-crud` package that generates Hono route handlers from a registered `Model`
- **Generated_Router**: The `Hono` router returned by the CRUD generator for a single model, containing all six operations
- **List_Route**: `GET /{basePath}` — paginated list with filtering and sorting
- **Read_Route**: `GET /{basePath}/:id` — single record by primary key
- **Create_Route**: `POST /{basePath}` — insert validated body
- **Replace_Route**: `PUT /{basePath}/:id` — full replace with validated body
- **Patch_Route**: `PATCH /{basePath}/:id` — partial update with validated body
- **Delete_Route**: `DELETE /{basePath}/:id` — delete by primary key
- **Primary_Key_Column**: The Drizzle column marked with `.primaryKey()` on the model's Drizzle table

---

## Requirements

### 1. Route Generation Trigger

**REQ-CG-001**
The Web_Loom_API shall call the CRUD generator for every model registered in the `Model_Registry` where `meta.crud` is `true` or a `CrudOptions` object.

**REQ-CG-002**
The CRUD generator shall produce a `Generated_Router` (a `Hono` instance) for each qualifying model.

**REQ-CG-003**
The Web_Loom_API shall mount each `Generated_Router` on the `Hono_App` using `app.route(model.meta.basePath, generatedRouter)` before mounting file-based route files.

---

### 2. List Route

**REQ-CG-010**
The `List_Route` shall accept the following query parameters:

- `page: number` (default: `1`, minimum: `1`)
- `limit: number` (default: `20`, minimum: `1`, maximum: `100`)
- `sort: string` — comma-separated field names, prefixed with `-` for descending (e.g., `sort=-createdAt,name`)
- `fields: string` — comma-separated column names for field selection
- `search: string` — full-text search across string columns (when supported by the database driver)

**REQ-CG-011**
The `List_Route` shall return a paginated response with:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**REQ-CG-012**
The `List_Route` shall use Drizzle's query builder (e.g., `db.select().from(table).limit(n).offset(n)`) to execute queries. It shall not construct raw SQL strings.

**REQ-CG-013**
The `List_Route` shall support equality filtering via additional query parameters matching column names (e.g., `?status=active`). Non-column query parameters shall be ignored.

**REQ-CG-014**
The `List_Route` shall support comparison operators via bracketed query parameters:

- `?age[gte]=18` → `gte(table.age, 18)`
- `?age[lte]=65` → `lte(table.age, 65)`
- `?name[like]=alice%` → `like(table.name, 'alice%')`
- `?status[in]=active,pending` → `inArray(table.status, ['active', 'pending'])`

**REQ-CG-015**
If an unrecognised sort field is provided, the `List_Route` shall return HTTP 400 with code `INVALID_SORT_FIELD` rather than silently ignoring it.

---

### 3. Read Route

**REQ-CG-020**
The `Read_Route` shall extract the `id` path parameter and query the database using `db.select().from(table).where(eq(table[pk], id))`.

**REQ-CG-021**
If no record is found with the given `id`, the `Read_Route` shall return HTTP 404 with `{ "error": { "code": "NOT_FOUND", "message": "<ModelName> not found" } }`.

**REQ-CG-022**
The `Read_Route` shall validate the `id` path parameter type against the `Primary_Key_Column`'s Drizzle column type. If the id fails type validation (e.g., non-UUID string for a UUID primary key), the route shall return HTTP 400.

---

### 4. Create Route

**REQ-CG-030**
The `Create_Route` shall validate the request body against `model.insertSchema` using `zValidator('json', model.insertSchema)`.

**REQ-CG-031**
The `Create_Route` shall insert the validated body using `db.insert(table).values(data).returning()` and return the created record as HTTP 201.

**REQ-CG-032**
If the database reports a unique constraint violation, the `Create_Route` shall return HTTP 409 with `{ "error": { "code": "CONFLICT", "message": "..." } }` rather than HTTP 500.

---

### 5. Replace Route

**REQ-CG-040**
The `Replace_Route` shall validate the request body against `model.insertSchema` (all required fields must be present).

**REQ-CG-041**
The `Replace_Route` shall update the record using `db.update(table).set(data).where(eq(table[pk], id)).returning()`.

**REQ-CG-042**
If no record is found with the given `id`, the `Replace_Route` shall return HTTP 404.

---

### 6. Patch Route

**REQ-CG-050**
The `Patch_Route` shall validate the request body against `model.updateSchema` (all fields optional).

**REQ-CG-051**
If the request body is empty (no fields provided), the `Patch_Route` shall return HTTP 400 with `{ "error": { "code": "VALIDATION_ERROR", "message": "Request body must contain at least one field" } }`.

**REQ-CG-052**
The `Patch_Route` shall update only the provided fields using `db.update(table).set(data).where(eq(table[pk], id)).returning()`.

**REQ-CG-053**
If no record is found with the given `id`, the `Patch_Route` shall return HTTP 404.

---

### 7. Delete Route

**REQ-CG-060**
The `Delete_Route` shall delete the record using `db.delete(table).where(eq(table[pk], id))`.

**REQ-CG-061**
The `Delete_Route` shall return HTTP 204 with no response body on success.

**REQ-CG-062**
If no record is found with the given `id`, the `Delete_Route` shall return HTTP 404.

**REQ-CG-063**
If the database reports a foreign key constraint violation, the `Delete_Route` shall return HTTP 409 with `{ "error": { "code": "CONFLICT", "message": "Cannot delete: record is referenced by other records" } }`.

---

### 8. Soft Delete

**REQ-CG-070**
Where a model's `CrudOptions` includes `softDelete: true`, the `Delete_Route` shall set `deletedAt = now()` on the record instead of executing a hard `DELETE`.

**REQ-CG-071**
While `softDelete: true` is enabled on a model, the `List_Route` and `Read_Route` shall append `where(isNull(table.deletedAt))` to all queries, excluding soft-deleted records.

---

### 9. Timestamps

**REQ-CG-080**
Where a model's `CrudOptions` includes `timestamps: true`, the `Create_Route` shall automatically set `createdAt` and `updatedAt` to the current UTC timestamp, overriding any value provided in the request body.

**REQ-CG-081**
Where a model's `CrudOptions` includes `timestamps: true`, the `Replace_Route` and `Patch_Route` shall automatically set `updatedAt` to the current UTC timestamp.

---

### 10. Auth Integration

**REQ-CG-090**
When a `CrudOperationOptions.auth` value is `true`, the CRUD generator shall prepend the `authenticate` middleware (from `@web-loom/api-middleware-auth`) to that operation's handler chain.

**REQ-CG-091**
When a `CrudOperationOptions.auth` value is a role string (e.g., `"admin"`), the CRUD generator shall prepend both the `authenticate` middleware and the `requireRole(role)` middleware to that operation's handler chain.

**REQ-CG-092**
When a `CrudOperationOptions.auth` value is `false` or absent, the operation's handler chain shall contain no authentication middleware.
