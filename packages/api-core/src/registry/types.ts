// Model Registry Types

/**
 * Field types supported by the framework
 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'uuid'
  | 'enum'
  | 'json'
  | 'array'
  | 'decimal';

/**
 * Validation rules for model fields
 */
export interface ValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
  integer?: boolean;
  positive?: boolean;
  uuid?: boolean;
  enum?: string[];
  custom?: (value: unknown) => boolean | string;
}

/**
 * Database field configuration
 */
export interface DatabaseFieldConfig {
  columnName?: string;
  type?: string;
  primaryKey?: boolean;
  unique?: boolean;
  index?: boolean;
  nullable?: boolean;
  default?: unknown;
  autoIncrement?: boolean;
}

/**
 * Field transformation function
 */
export type FieldTransform = (value: unknown) => unknown;

/**
 * Field definition in a model
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
  validation?: ValidationRules;
  database?: DatabaseFieldConfig;
  computed?: boolean;
  transform?: FieldTransform;
  default?: unknown | (() => unknown);
}

/**
 * Relationship types between models
 */
export type RelationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany';

/**
 * Relationship definition between models
 */
export interface Relationship {
  type: RelationType;
  model: string;
  foreignKey?: string;
  localKey?: string;
  through?: string;
  as?: string;
}

/**
 * CRUD generation options
 */
export interface CRUDOptions {
  endpoints?: {
    create?: boolean;
    list?: boolean;
    get?: boolean;
    update?: boolean;
    patch?: boolean;
    delete?: boolean;
  };
  pagination?: boolean;
  filtering?: boolean;
  sorting?: boolean;
  search?: boolean;
}

/**
 * Permission configuration for a model
 */
export interface PermissionConfig {
  create?: string[];
  read?: string[];
  update?: string[];
  delete?: string[];
}

/**
 * Model-level options
 */
export interface ModelOptions {
  timestamps?: boolean;
  softDelete?: boolean;
  optimisticLocking?: boolean;
  crud?: boolean | CRUDOptions;
  permissions?: PermissionConfig;
}

/**
 * Model metadata for documentation
 */
export interface ModelMetadata {
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  version?: string;
  examples?: Record<string, unknown>[];
}

/**
 * Complete model definition
 */
export interface ModelDefinition {
  name: string;
  tableName?: string;
  fields: FieldDefinition[];
  relationships?: Relationship[];
  options?: ModelOptions;
  metadata?: ModelMetadata;
}
