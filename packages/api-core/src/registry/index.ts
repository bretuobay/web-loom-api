// Registry exports
export { ModelRegistry } from './model-registry';
export type {
  FieldType,
  RelationType,
  ValidationRules,
  FieldTransform,
  CRUDOptions,
  PermissionConfig,
  ModelMetadata,
} from './types';

// Re-export shared types from interfaces to avoid duplication
export type {
  DatabaseFieldConfig,
  FieldDefinition,
  ModelDefinition,
  ModelOptions,
  Relationship,
} from '../interfaces/database-adapter';

// Placeholder for RouteRegistry
export class RouteRegistry {
  // Implementation will be added in later tasks
}
