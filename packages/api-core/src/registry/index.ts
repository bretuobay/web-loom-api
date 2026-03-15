// Registry exports
export { ModelRegistry } from './model-registry';
export { RouteRegistry } from './route-registry';
export { RouteDiscovery } from './route-discovery';

// Model Registry types
export type {
  FieldType,
  RelationType,
  ValidationRules,
  FieldTransform,
  CRUDOptions,
  PermissionConfig,
  ModelMetadata,
} from './types';

// Route Registry types
export type {
  RouteDefinition,
  RouteValidation,
  AuthRequirement,
  RouteRateLimitConfig,
  CacheConfig,
  RouteMetadata,
  ResponseDefinition,
  RouteMatch,
} from './route-types';

// Re-export shared types from interfaces to avoid duplication
export type {
  DatabaseFieldConfig,
  FieldDefinition,
  ModelDefinition,
  ModelOptions,
  Relationship,
} from '../interfaces/database-adapter';
