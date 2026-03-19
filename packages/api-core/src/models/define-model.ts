import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { Table } from 'drizzle-orm';
import { modelRegistry } from './registry';
import type { Model, ModelMeta, SchemaOverrides } from './types';

/**
 * Register a Drizzle table as a Web Loom model.
 *
 * Derives Zod schemas automatically via `drizzle-zod` and registers the model
 * with the global `modelRegistry`. Both the CRUD generator and OpenAPI generator
 * consume this registry to produce routes and documentation.
 *
 * @example
 * ```ts
 * import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
 * import { defineModel } from '@web-loom/api-core';
 *
 * export const usersTable = pgTable('users', {
 *   id: uuid('id').defaultRandom().primaryKey(),
 *   email: text('email').notNull().unique(),
 * });
 *
 * export const User = defineModel(usersTable, {
 *   name: 'User',
 *   crud: { list: { auth: false }, create: { auth: true } },
 * });
 * ```
 */
export function defineModel<TTable extends Table>(
  table: TTable,
  meta: ModelMeta,
  overrides?: SchemaOverrides,
): Model<TTable> {
  // Derive schemas from the Drizzle table via drizzle-zod
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let insertSchema = createInsertSchema(table) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let selectSchema = createSelectSchema(table) as any;
  let updateSchema = insertSchema.partial();

  // Apply optional consumer overrides after drizzle-zod generation
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
    // Type-only — no runtime value needed; Drizzle infers these from the table
    $inferSelect: undefined as unknown as TTable['$inferSelect'],
    $inferInsert: undefined as unknown as TTable['$inferInsert'],
  };

  modelRegistry.register(model);

  return model;
}
