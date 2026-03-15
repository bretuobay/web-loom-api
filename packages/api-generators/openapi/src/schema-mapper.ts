/**
 * Schema Mapper
 * 
 * Maps model field types to OpenAPI schema types
 */

import type { OpenAPISchema } from './types';

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
 * Field definition in a model
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
  validation?: ValidationRules;
  database?: {
    columnName?: string;
    type?: string;
    primaryKey?: boolean;
    unique?: boolean;
    index?: boolean;
    nullable?: boolean;
    default?: unknown;
    autoIncrement?: boolean;
  };
  computed?: boolean;
  transform?: (value: unknown) => unknown;
  default?: unknown | (() => unknown);
}

/**
 * Map field type to OpenAPI schema type and format
 */
export function mapFieldTypeToSchema(fieldType: FieldType): Pick<OpenAPISchema, 'type' | 'format'> {
  switch (fieldType) {
    case 'string':
      return { type: 'string' };
    
    case 'number':
      return { type: 'number' };
    
    case 'boolean':
      return { type: 'boolean' };
    
    case 'date':
      return { type: 'string', format: 'date-time' };
    
    case 'uuid':
      return { type: 'string', format: 'uuid' };
    
    case 'enum':
      return { type: 'string' };
    
    case 'json':
      return { type: 'object' };
    
    case 'array':
      return { type: 'array' };
    
    case 'decimal':
      return { type: 'number', format: 'double' };
    
    default:
      return { type: 'string' };
  }
}

/**
 * Map validation rules to OpenAPI schema constraints
 */
export function mapValidationRulesToSchema(validation: ValidationRules): Partial<OpenAPISchema> {
  const schema: Partial<OpenAPISchema> = {};
  
  // Min/max constraints
  if (validation.min !== undefined) {
    schema.minimum = validation.min;
    schema.minLength = validation.min;
  }
  
  if (validation.max !== undefined) {
    schema.maximum = validation.max;
    schema.maxLength = validation.max;
  }
  
  // Pattern constraint
  if (validation.pattern) {
    schema.pattern = validation.pattern;
  }
  
  // Email format
  if (validation.email) {
    schema.format = 'email';
  }
  
  // URL format
  if (validation.url) {
    schema.format = 'uri';
  }
  
  // Integer constraint
  if (validation.integer) {
    schema.type = 'integer';
  }
  
  // UUID format
  if (validation.uuid) {
    schema.format = 'uuid';
  }
  
  // Enum values
  if (validation.enum && validation.enum.length > 0) {
    schema.enum = validation.enum;
  }
  
  return schema;
}

/**
 * Convert field definition to OpenAPI schema
 */
export function fieldToSchema(field: FieldDefinition): OpenAPISchema {
  const baseSchema = mapFieldTypeToSchema(field.type);
  const schema: OpenAPISchema = {
    ...baseSchema,
    description: field.name,
  };
  
  // Add validation constraints
  if (field.validation) {
    Object.assign(schema, mapValidationRulesToSchema(field.validation));
  }
  
  // Add default value
  if (field.default !== undefined) {
    schema.default = typeof field.default === 'function' ? undefined : field.default;
  }
  
  // Handle array items
  if (field.type === 'array') {
    schema.items = { type: 'string' }; // Default to string array
  }
  
  // Mark as read-only if computed
  if (field.computed) {
    schema.readOnly = true;
  }
  
  return schema;
}

/**
 * Generate example value for a field type
 */
export function generateExampleValue(fieldType: FieldType, fieldName: string): unknown {
  switch (fieldType) {
    case 'string':
      return `example-${fieldName}`;
    
    case 'number':
    case 'decimal':
      return 42;
    
    case 'boolean':
      return true;
    
    case 'date':
      return new Date().toISOString();
    
    case 'uuid':
      return '123e4567-e89b-12d3-a456-426614174000';
    
    case 'enum':
      return 'OPTION_1';
    
    case 'json':
      return { key: 'value' };
    
    case 'array':
      return ['item1', 'item2'];
    
    default:
      return null;
  }
}
