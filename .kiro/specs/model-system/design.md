# Design: Model System

## Overview

`defineModel()` is a thin registration wrapper. The Drizzle table is the schema. `drizzle-zod` derives Zod schemas automatically. No proprietary field DSL.

```
Drizzle Table (pgTable / sqliteTable)
         │
         ├── drizzle-zod ──► insertSchema (ZodObject)
         │                ├── updateSchema = insertSchema.partial()
         │                └── selectSchema (ZodObject)
         │
         └── defineModel(table, meta)
                │
                └── Model<TTable>
                      ├── .table        (Drizzle table ref)
                      ├── .insertSchema
                      ├── .selectSchema
                      ├── .updateSchema
                      ├── .meta         (name, basePath, crud options)
                      ├── .$inferSelect (TypeScript type)
                      └── .$inferInsert (TypeScript type)
                           │
                           └── registered in ModelRegistry (singleton)
```

## Types

```typescript
// packages/api-core/src/models/types.ts

import type { Table } from 'drizzle-orm';
import type { ZodObject, ZodRawShape } from 'zod';

export interface CrudOperationOptions {
  auth?: boolean | string; // false = public, true = any authed, "admin" = role check
  cache?: { ttl: number; tags?: string[] };
  softDelete?: boolean; // only relevant on delete operation
}

export interface CrudOptions {
  timestamps?: boolean; // auto-manage createdAt/updatedAt
  softDelete?: boolean; // global soft-delete for the model
  list?: CrudOperationOptions;
  read?: CrudOperationOptions;
  create?: CrudOperationOptions;
  update?: CrudOperationOptions;
  delete?: CrudOperationOptions;
}

export interface ModelMeta {
  name: string; // PascalCase, e.g. "User"
  basePath?: string; // default: "/" + name.toLowerCase() + "s"
  crud?: boolean | CrudOptions;
}

export interface SchemaOverrides<TInsert extends ZodRawShape, TSelect extends ZodRawShape> {
  insert?: (schema: ZodObject<TInsert>) => ZodObject<any>;
  select?: (schema: ZodObject<TSelect>) => ZodObject<any>;
  update?: (schema: ZodObject<Partial<TInsert>>) => ZodObject<any>;
}

export interface Model<TTable extends Table> {
  table: TTable;
  insertSchema: ZodObject<any>;
  selectSchema: ZodObject<any>;
  updateSchema: ZodObject<any>;
  meta: Required<ModelMeta>;
  $inferSelect: TTable['$inferSelect'];
  $inferInsert: TTable['$inferInsert'];
}

/** Utility type: extract Select and Insert types from a Model */
export type InferModel<TModel extends Model<any>> = {
  select: TModel['$inferSelect'];
  insert: TModel['$inferInsert'];
};
```

## defineModel() Implementation

```typescript
// packages/api-core/src/models/define-model.ts

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { modelRegistry } from './registry';
import type { Table } from 'drizzle-orm';
import type { Model, ModelMeta, SchemaOverrides } from './types';

export function defineModel<TTable extends Table>(
  table: TTable,
  meta: ModelMeta,
  overrides?: SchemaOverrides<any, any>
): Model<TTable> {
  // Derive schemas from Drizzle table via drizzle-zod
  let insertSchema = createInsertSchema(table);
  let selectSchema = createSelectSchema(table);
  let updateSchema = insertSchema.partial();

  // Apply optional consumer overrides
  if (overrides?.insert) insertSchema = overrides.insert(insertSchema);
  if (overrides?.select) selectSchema = overrides.select(selectSchema);
  if (overrides?.update) updateSchema = overrides.update(updateSchema);

  const model: Model<TTable> = {
    table,
    insertSchema,
    selectSchema,
    updateSchema,
    meta: {
      name: meta.name,
      basePath: meta.basePath ?? '/' + meta.name.toLowerCase() + 's',
      crud: meta.crud ?? false,
    },
    $inferSelect: undefined as TTable['$inferSelect'], // type-only, no runtime value
    $inferInsert: undefined as TTable['$inferInsert'], // type-only, no runtime value
  };

  // Auto-register with the global model registry
  modelRegistry.register(model);

  return model;
}
```

## Usage Pattern

```typescript
// src/models/user.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { defineModel } from '@web-loom/api-core';

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['user', 'admin'] })
    .default('user')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const User = defineModel(usersTable, {
  name: 'User',
  crud: {
    timestamps: true,
    list: { auth: false },
    read: { auth: false },
    create: { auth: true },
    update: { auth: 'admin' },
    delete: { auth: 'admin' },
  },
});

// Inferred types (no manual type declarations needed):
// User.$inferSelect → { id: string; name: string; email: string; role: "user" | "admin"; createdAt: Date; updatedAt: Date }
// User.$inferInsert → { id?: string; name: string; email: string; role?: "user" | "admin"; ... }
// User.insertSchema → ZodObject (validated by zValidator in routes/CRUD)
```

## Model Registry

```typescript
// packages/api-core/src/models/registry.ts

import type { Table } from 'drizzle-orm';
import type { Model } from './types';

export class ModelRegistry {
  private models = new Map<string, Model<Table>>();

  register(model: Model<Table>): void {
    if (this.models.has(model.meta.name)) {
      throw new DuplicateModelError(model.meta.name);
    }
    this.models.set(model.meta.name, model);
  }

  get(name: string): Model<Table> | undefined {
    return this.models.get(name);
  }

  getAll(): Model<Table>[] {
    return [...this.models.values()];
  }

  has(name: string): boolean {
    return this.models.has(name);
  }

  clear(): void {
    this.models.clear();
  }
}

/** Singleton used by defineModel() and the CRUD/OpenAPI generators */
export const modelRegistry = new ModelRegistry();
```

## Serialisation Utility

```typescript
// packages/api-core/src/models/serialize.ts

export function serializeModel(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data.toISOString();
  if (typeof data === 'bigint') return data.toString();
  if (Buffer.isBuffer(data)) return data.toString('base64');
  if (Array.isArray(data)) return data.map(serializeModel);
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, serializeModel(v)])
    );
  }
  return data;
}
```
