# Design: CRUD Generator

## Overview

The CRUD generator takes a `Model<TTable>` and returns a `Hono` router with six handlers, each using Drizzle's native query builder.

```
Model<TTable>
  ├── .table         (Drizzle table)
  ├── .insertSchema  (Zod — for POST/PUT validation)
  ├── .updateSchema  (Zod — for PATCH validation)
  └── .meta.crud     (CrudOptions — auth, timestamps, softDelete)
          │
          ▼
  generateCrudRouter(model) → Hono<{ Variables: WebLoomVariables }>
          │
          ├── GET    /          → list (paginated + filtered)
          ├── POST   /          → create
          ├── GET    /:id       → read by pk
          ├── PUT    /:id       → replace
          ├── PATCH  /:id       → partial update
          └── DELETE /:id       → delete (hard or soft)
```

## generateCrudRouter()

```typescript
// packages/api-generators/crud/src/generate-crud-router.ts

import { Hono } from 'hono';
import { eq, and, isNull } from 'drizzle-orm';
import { validate } from '@web-loom/api-core';
import type { Model, WebLoomVariables } from '@web-loom/api-core';
import type { Table } from 'drizzle-orm';
import { buildListHandler } from './handlers/list';
import { buildReadHandler } from './handlers/read';
import { buildCreateHandler } from './handlers/create';
import { buildReplaceHandler } from './handlers/replace';
import { buildPatchHandler } from './handlers/patch';
import { buildDeleteHandler } from './handlers/delete';
import { resolveAuthMiddleware } from './auth-resolver';

export function generateCrudRouter<TTable extends Table>(
  model: Model<TTable>
): Hono<{ Variables: WebLoomVariables }> {
  const router = new Hono<{ Variables: WebLoomVariables }>();
  const opts = typeof model.meta.crud === 'boolean' ? {} : (model.meta.crud ?? {});

  router.get('/', ...resolveAuthMiddleware(opts.list), buildListHandler(model));
  router.post(
    '/',
    ...resolveAuthMiddleware(opts.create),
    validate('json', model.insertSchema),
    buildCreateHandler(model)
  );
  router.get('/:id', ...resolveAuthMiddleware(opts.read), buildReadHandler(model));
  router.put(
    '/:id',
    ...resolveAuthMiddleware(opts.update),
    validate('json', model.insertSchema),
    buildReplaceHandler(model)
  );
  router.patch(
    '/:id',
    ...resolveAuthMiddleware(opts.update),
    validate('json', model.updateSchema),
    buildPatchHandler(model)
  );
  router.delete('/:id', ...resolveAuthMiddleware(opts.delete), buildDeleteHandler(model));

  return router;
}
```

## List Handler

```typescript
// packages/api-generators/crud/src/handlers/list.ts

import { asc, desc, eq, gte, lte, like, inArray, and, isNull, count } from 'drizzle-orm';
import { serializeModel } from '@web-loom/api-core';

export function buildListHandler<TTable extends Table>(model: Model<TTable>): RouteHandler {
  return async (c) => {
    const db = c.var.db;
    const query = c.req.query();
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = buildWhereConditions(model.table, query);

    // Soft delete filter
    const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};
    if (opts.softDelete && 'deletedAt' in model.table) {
      conditions.push(isNull((model.table as any).deletedAt));
    }

    // Build ORDER BY
    const orderClauses = buildOrderBy(model.table, query.sort);

    // Execute paginated query
    const [rows, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(model.table)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(...orderClauses)
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(model.table)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    const totalPages = Math.ceil(total / limit);

    return c.json({
      data: rows.map(serializeModel),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  };
}

/** Parses query params into Drizzle WHERE conditions */
function buildWhereConditions(table: Table, query: Record<string, string>) {
  const conditions = [];
  const columns = Object.keys(table[Symbol.for('drizzle:Columns')] ?? {});

  for (const [key, value] of Object.entries(query)) {
    // Bracketed operators: age[gte]=18
    const opMatch = key.match(/^(\w+)\[(gte|lte|like|in)\]$/);
    if (opMatch) {
      const [, col, op] = opMatch;
      if (!columns.includes(col)) continue;
      const column = (table as any)[col];
      if (op === 'gte') conditions.push(gte(column, coerce(column, value)));
      if (op === 'lte') conditions.push(lte(column, coerce(column, value)));
      if (op === 'like') conditions.push(like(column, value));
      if (op === 'in') conditions.push(inArray(column, value.split(',')));
      continue;
    }
    // Skip non-column query params
    if (!columns.includes(key)) continue;
    conditions.push(eq((table as any)[key], coerce((table as any)[key], value)));
  }

  return conditions;
}
```

## Create Handler

```typescript
// packages/api-generators/crud/src/handlers/create.ts

export function buildCreateHandler<TTable extends Table>(model: Model<TTable>): RouteHandler {
  return async (c) => {
    const db = c.var.db;
    const data = c.req.valid('json') as TTable['$inferInsert'];
    const opts = typeof model.meta.crud === 'object' ? model.meta.crud : {};

    // Auto-timestamps
    if (opts.timestamps) {
      const now = new Date();
      (data as any).createdAt = now;
      (data as any).updatedAt = now;
    }

    try {
      const [record] = await db.insert(model.table).values(data).returning();
      return c.json(serializeModel(record), 201);
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new ConflictError('A record with this value already exists');
      }
      throw err;
    }
  };
}
```

## Auth Resolver

```typescript
// packages/api-generators/crud/src/auth-resolver.ts

import { authenticate, requireRole } from '@web-loom/api-middleware-auth';

export function resolveAuthMiddleware(opts: CrudOperationOptions | undefined): MiddlewareHandler[] {
  if (!opts?.auth) return []; // public
  if (opts.auth === true) return [authenticate]; // any authenticated user
  return [authenticate, requireRole(opts.auth)]; // specific role
}
```

## Primary Key Resolution

```typescript
// packages/api-generators/crud/src/pk-resolver.ts

import { getTableColumns } from 'drizzle-orm';

export function getPrimaryKeyColumn(table: Table): Column {
  const columns = getTableColumns(table);
  const pk = Object.values(columns).find((col) => col.primary);
  if (!pk) {
    throw new Error(`Model table has no primary key column`);
  }
  return pk;
}
```
