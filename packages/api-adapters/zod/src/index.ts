/**
 * @web-loom/api-adapter-zod
 * 
 * Zod adapter for Web Loom API Framework
 * Provides runtime type validation with TypeScript type inference
 */

export { ZodAdapter } from './zod-adapter';
export type {
  ValidationAdapter,
  Schema,
  SchemaDefinition,
  FieldSchema,
  ValidationResult,
  ValidationError,
} from '@web-loom/api-core';
