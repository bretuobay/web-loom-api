// Registry exports
// Note: ModelRegistry is now exported from '../models/registry' (Drizzle-based).
// The legacy adapter-based ModelRegistry lives in './model-registry' for backward
// compatibility but is no longer part of the public API.
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

// Route handler and middleware types (opaque introspection types for the registry)
export type { RouteHandler, Middleware } from './route-types';
