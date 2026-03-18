/**
 * Model system types for Web Loom API Framework
 *
 * The Drizzle table definition is the single source of truth.
 * `defineModel()` wraps a Drizzle table and derives Zod schemas via `drizzle-zod`.
 */

import type { Table } from 'drizzle-orm';
import type { ZodObject, ZodRawShape } from 'zod';

// ============================================================================
// CRUD options
// ============================================================================

export interface CrudOperationOptions {
  /** false = public, true = any authenticated user, "admin" = role check */
  auth?: boolean | string;
  cache?: { ttl: number; tags?: string[] };
  /** Only meaningful on the delete operation */
  softDelete?: boolean;
}

export interface CrudOptions {
  /** Auto-manage createdAt/updatedAt fields */
  timestamps?: boolean;
  /** Enable soft-delete for the model */
  softDelete?: boolean;
  list?: CrudOperationOptions;
  read?: CrudOperationOptions;
  create?: CrudOperationOptions;
  update?: CrudOperationOptions;
  delete?: CrudOperationOptions;
}

// ============================================================================
// ModelMeta
// ============================================================================

export interface ModelMeta {
  /** PascalCase model name, e.g. "User" */
  name: string;
  /** URL prefix for auto-generated CRUD routes. Default: "/" + name.toLowerCase() + "s" */
  basePath?: string;
  /** Whether to auto-generate CRUD routes for this model */
  crud?: boolean | CrudOptions;
}

// ============================================================================
// Schema overrides
// ============================================================================

export interface SchemaOverrides<
  TInsert extends ZodRawShape = ZodRawShape,
  TSelect extends ZodRawShape = ZodRawShape,
> {
  insert?: (schema: ZodObject<TInsert>) => ZodObject<ZodRawShape>;
  select?: (schema: ZodObject<TSelect>) => ZodObject<ZodRawShape>;
  update?: (schema: ZodObject<Partial<TInsert>>) => ZodObject<ZodRawShape>;
}

// ============================================================================
// Model
// ============================================================================

export interface Model<TTable extends Table> {
  /** The original Drizzle table definition */
  table: TTable;
  /** Zod schema for insert operations (POST/PUT) */
  insertSchema: ZodObject<ZodRawShape>;
  /** Zod schema for select operations (response typing) */
  selectSchema: ZodObject<ZodRawShape>;
  /** Zod schema for partial updates (PATCH) — all fields optional */
  updateSchema: ZodObject<ZodRawShape>;
  /** Resolved model metadata */
  meta: Required<ModelMeta>;
  /** TypeScript type for a selected row */
  $inferSelect: TTable['$inferSelect'];
  /** TypeScript type for an inserted row */
  $inferInsert: TTable['$inferInsert'];
}

/** Utility type: extract Select and Insert types from a Model */
export type InferModel<TModel extends Model<Table>> = {
  select: TModel['$inferSelect'];
  insert: TModel['$inferInsert'];
};

/** Any model, for use in registry storage */
export type AnyModel = Model<Table>;
