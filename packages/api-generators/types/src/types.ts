/**
 * Type Generator Types
 */

/**
 * Type generator options
 */
export interface TypeGeneratorOptions {
  /** Include JSDoc comments */
  includeJSDoc?: boolean;
  
  /** Generate enum types */
  generateEnums?: boolean;
  
  /** Generate request/response types */
  generateRequestResponseTypes?: boolean;
  
  /** Export format */
  exportFormat?: 'esm' | 'cjs' | 'both';
  
  /** Add readonly modifiers */
  readonly?: boolean;
  
  /** Generate utility types */
  generateUtilityTypes?: boolean;
}

/**
 * Generated types structure
 */
export interface GeneratedTypes {
  /** Model types */
  models: string;
  
  /** Enum types */
  enums?: string;
  
  /** Request/response types */
  requestResponse?: string;
  
  /** Utility types */
  utils?: string;
}

/**
 * Field type
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
 * Model field definition
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  enum?: string[];
  arrayItemType?: FieldType;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    email?: boolean;
    url?: boolean;
  };
  metadata?: {
    description?: string;
    example?: unknown;
    deprecated?: boolean;
  };
}

/**
 * Model definition
 */
export interface ModelDefinition {
  name: string;
  fields: FieldDefinition[];
  metadata?: {
    description?: string;
    tableName?: string;
    timestamps?: boolean;
    softDelete?: boolean;
  };
}

/**
 * Enum definition
 */
export interface EnumDefinition {
  name: string;
  values: Array<{
    key: string;
    value: string | number;
    description?: string;
  }>;
  metadata?: {
    description?: string;
  };
}

/**
 * HTTP method type
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Route definition
 */
export interface RouteDefinition {
  path: string;
  method: HTTPMethod;
  metadata?: {
    description?: string;
    tags?: string[];
  };
}
