/**
 * @web-loom/api-adapter-drizzle
 * 
 * Drizzle ORM adapter for Web Loom API Framework
 * Provides database connectivity using Drizzle ORM with Neon serverless Postgres
 */

export { DrizzleAdapter } from './drizzle-adapter';
export type {
  DatabaseAdapter,
  Transaction,
  ModelDefinition,
  FieldDefinition,
  DatabaseFieldConfig,
  Relationship,
  ModelOptions,
  QueryBuilder,
  Migration,
} from '@web-loom/api-core';
