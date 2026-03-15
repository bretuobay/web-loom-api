/**
 * @web-loom/api-generator-crud
 * 
 * CRUD generator for Web Loom API Framework
 * Automatically generates REST API endpoints for CRUD operations
 */

export { CRUDGenerator } from './crud-generator';
export type { CRUDOptions, RouteHandler } from './crud-generator';

export type {
  ModelDefinition,
  DatabaseAdapter,
  RequestContext,
  NextFunction,
} from '@web-loom/api-core';
