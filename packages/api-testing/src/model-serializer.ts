/**
 * Model Serialization Utilities
 *
 * Provides serialize/deserialize for model objects with schema-based
 * type handling, including special types: Date, BigInt, Buffer.
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'bigint'
  | 'buffer'
  | 'object'
  | 'array';

export interface FieldDef {
  type: FieldType;
  required?: boolean;
  items?: FieldDef;
}

export interface ModelSchema {
  fields: Record<string, FieldDef>;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Serialize a single value according to its field definition.
 */
function serializeValue(value: unknown, fieldDef: FieldDef): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  switch (fieldDef.type) {
    case 'date':
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return value;
        return { __type: 'date', value: value.toISOString() };
      }
      return value;

    case 'bigint':
      if (typeof value === 'bigint') {
        return { __type: 'bigint', value: value.toString() };
      }
      return value;


    case 'buffer':
      if (Buffer.isBuffer(value)) {
        return { __type: 'buffer', value: value.toString('base64') };
      }
      return value;

    case 'array':
      if (Array.isArray(value) && fieldDef.items) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return value.map((item) => serializeValue(item, fieldDef.items!));
      }
      return value;

    case 'object':
      if (typeof value === 'object') {
        return value;
      }
      return value;

    default:
      return value;
  }
}

/**
 * Deserialize a single value according to its field definition.
 */
function deserializeValue(value: unknown, fieldDef: FieldDef): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  switch (fieldDef.type) {
    case 'date':
      if (
        typeof value === 'object' &&
        value !== null &&
        '__type' in value &&
        (value as Record<string, unknown>).__type === 'date'
      ) {
        return new Date((value as Record<string, unknown>).value as string);
      }
      return value;

    case 'bigint':
      if (
        typeof value === 'object' &&
        value !== null &&
        '__type' in value &&
        (value as Record<string, unknown>).__type === 'bigint'
      ) {
        return BigInt((value as Record<string, unknown>).value as string);
      }
      return value;

    case 'buffer':
      if (
        typeof value === 'object' &&
        value !== null &&
        '__type' in value &&
        (value as Record<string, unknown>).__type === 'buffer'
      ) {
        return Buffer.from(
          (value as Record<string, unknown>).value as string,
          'base64',
        );
      }
      return value;

    case 'array':
      if (Array.isArray(value) && fieldDef.items) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return value.map((item) => deserializeValue(item, fieldDef.items!));
      }
      return value;

    case 'object':
      return value;

    default:
      return value;
  }
}

/**
 * Validate a value matches the expected field type.
 */
function validateFieldType(
  value: unknown,
  fieldDef: FieldDef,
  fieldName: string,
): void {
  if (value === null || value === undefined) {
    return;
  }

  switch (fieldDef.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ValidationError(
          `Field "${fieldName}" expected string, got ${typeof value}`,
        );
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        throw new ValidationError(
          `Field "${fieldName}" expected number, got ${typeof value}`,
        );
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ValidationError(
          `Field "${fieldName}" expected boolean, got ${typeof value}`,
        );
      }
      break;
    case 'date':
      if (!(value instanceof Date)) {
        throw new ValidationError(
          `Field "${fieldName}" expected Date, got ${typeof value}`,
        );
      }
      break;
    case 'bigint':
      if (typeof value !== 'bigint') {
        throw new ValidationError(
          `Field "${fieldName}" expected bigint, got ${typeof value}`,
        );
      }
      break;
    case 'buffer':
      if (!Buffer.isBuffer(value)) {
        throw new ValidationError(
          `Field "${fieldName}" expected Buffer, got ${typeof value}`,
        );
      }
      break;
    case 'object':
      if (typeof value !== 'object') {
        throw new ValidationError(
          `Field "${fieldName}" expected object, got ${typeof value}`,
        );
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        throw new ValidationError(
          `Field "${fieldName}" expected array, got ${typeof value}`,
        );
      }
      break;
  }
}

/**
 * Serialize a model object to a JSON string using the given schema.
 */
export function serialize(model: Record<string, unknown>, schema: ModelSchema): string {
  const serialized: Record<string, unknown> = {};

  for (const [key, fieldDef] of Object.entries(schema.fields)) {
    if (key in model) {
      serialized[key] = serializeValue(model[key], fieldDef);
    }
  }

  return JSON.stringify(serialized);
}

/**
 * Deserialize a JSON string back to a model object using the given schema.
 * Validates the result against the schema.
 */
export function deserialize(
  json: string,
  schema: ModelSchema,
): Record<string, unknown> {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, fieldDef] of Object.entries(schema.fields)) {
    if (key in parsed) {
      result[key] = deserializeValue(parsed[key], fieldDef);
    } else if (fieldDef.required) {
      throw new ValidationError(`Missing required field "${key}"`);
    }
  }

  // Validate types after deserialization
  for (const [key, fieldDef] of Object.entries(schema.fields)) {
    if (key in result) {
      validateFieldType(result[key], fieldDef, key);
    }
  }

  return result;
}

/**
 * Validate deserialized data against a schema.
 * Throws ValidationError if data doesn't match.
 */
export function validateDeserialized(
  data: Record<string, unknown>,
  schema: ModelSchema,
): void {
  for (const [key, fieldDef] of Object.entries(schema.fields)) {
    if (fieldDef.required && !(key in data)) {
      throw new ValidationError(`Missing required field "${key}"`);
    }
    if (key in data) {
      validateFieldType(data[key], fieldDef, key);
    }
  }
}
