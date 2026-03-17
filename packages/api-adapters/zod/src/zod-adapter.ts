/**
 * Zod Validation Adapter
 * 
 * Implementation of ValidationAdapter using Zod for runtime type validation
 * with TypeScript type inference.
 * 
 * @example
 * ```typescript
 * const adapter = new ZodAdapter();
 * 
 * const userSchema = adapter.defineSchema({
 *   email: { type: 'string', format: 'email' },
 *   age: { type: 'number', min: 0, max: 120 }
 * });
 * 
 * const result = adapter.validate(userSchema, { email: 'user@example.com', age: 25 });
 * if (result.success) {
 *   console.log('Valid data:', result.data);
 * }
 * ```
 */

import { z, type ZodSchema, type ZodError } from 'zod';
import type {
  ValidationAdapter,
  Schema,
  SchemaDefinition,
  FieldSchema,
  ValidationResult,
  ValidationError, ValidationFieldError} from '@web-loom/api-core';

/**
 * Zod adapter implementation
 */
export class ZodAdapter implements ValidationAdapter {
  /**
   * Define a validation schema from a schema definition
   */
  defineSchema<T>(definition: SchemaDefinition): Schema<T> {
    const zodSchema = this.buildZodSchema(definition);
    return { _zodSchema: zodSchema } as Schema<T>;
  }

  /**
   * Validate data against a schema synchronously
   */
  validate<T>(schema: Schema<T>, data: unknown): ValidationResult<T> {
    const zodSchema = this.getZodSchema(schema);
    const result = zodSchema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data as T,
      };
    }

    // result.error is the ZodError when success is false
    if (!result.error) {
      return {
        success: false,
        errors: [],
      };
    }

    return {
      success: false,
      errors: this.formatZodErrors(result.error),
    };
  }

  /**
   * Validate data against a schema asynchronously
   */
  async validateAsync<T>(schema: Schema<T>, data: unknown): Promise<ValidationResult<T>> {
    const zodSchema = this.getZodSchema(schema);
    const result = await zodSchema.safeParseAsync(data);

    if (result.success) {
      return {
        success: true,
        data: result.data as T,
      };
    }

    return {
      success: false,
      errors: this.formatZodErrors(result.error),
    };
  }

  /**
   * Merge two schemas into a single schema
   */
  merge<T, U>(schema1: Schema<T>, schema2: Schema<U>): Schema<T & U> {
    const zodSchema1 = this.getZodSchema(schema1);
    const zodSchema2 = this.getZodSchema(schema2);

    // Ensure both are object schemas before merging
    if (zodSchema1 instanceof z.ZodObject && zodSchema2 instanceof z.ZodObject) {
      const merged = zodSchema1.merge(zodSchema2);
      return { _zodSchema: merged } as Schema<T & U>;
    }

    throw new Error('Both schemas must be object schemas to merge');
  }

  /**
   * Create a schema with all fields optional
   */
  partial<T>(schema: Schema<T>): Schema<Partial<T>> {
    const zodSchema = this.getZodSchema(schema);

    if (zodSchema instanceof z.ZodObject) {
      const partial = zodSchema.partial();
      return { _zodSchema: partial } as Schema<Partial<T>>;
    }

    throw new Error('Schema must be an object schema to make partial');
  }

  /**
   * Create a schema with only specified fields
   */
  pick<T, K extends keyof T>(schema: Schema<T>, keys: K[]): Schema<Pick<T, K>> {
    const zodSchema = this.getZodSchema(schema);

    if (zodSchema instanceof z.ZodObject) {
      const pickObj = keys.reduce((acc, key) => {
        acc[key as string] = true;
        return acc;
      }, {} as Record<string, true>);

      const picked = zodSchema.pick(pickObj);
      return { _zodSchema: picked } as Schema<Pick<T, K>>;
    }

    throw new Error('Schema must be an object schema to pick fields');
  }

  /**
   * Build a Zod schema from a schema definition
   */
  private buildZodSchema(definition: SchemaDefinition): ZodSchema {
    const shape: Record<string, ZodSchema> = {};

    for (const [key, fieldDef] of Object.entries(definition)) {
      if (this.isFieldSchema(fieldDef)) {
        shape[key] = this.buildFieldSchema(fieldDef);
      }
    }

    return z.object(shape);
  }

  /**
   * Build a Zod schema for a single field
   */
  private buildFieldSchema(field: FieldSchema): ZodSchema {
    let schema: ZodSchema;

    // Build base schema based on type
    switch (field.type) {
      case 'string':
        schema = z.string();
        
        // Apply string constraints
        if (field.minLength !== undefined) {
          schema = (schema as z.ZodString).min(field.minLength, {
            message: `Must be at least ${field.minLength} characters`,
          });
        }
        if (field.maxLength !== undefined) {
          schema = (schema as z.ZodString).max(field.maxLength, {
            message: `Must be at most ${field.maxLength} characters`,
          });
        }
        if (field.pattern) {
          schema = (schema as z.ZodString).regex(new RegExp(field.pattern), {
            message: `Must match pattern ${field.pattern}`,
          });
        }
        if (field.format === 'email') {
          schema = (schema as z.ZodString).email({ message: 'Invalid email format' });
        }
        if (field.format === 'url') {
          schema = (schema as z.ZodString).url({ message: 'Invalid URL format' });
        }
        if (field.format === 'uuid') {
          schema = (schema as z.ZodString).uuid({ message: 'Invalid UUID format' });
        }
        if (field.format === 'date' || field.format === 'datetime') {
          schema = (schema as z.ZodString).datetime({ message: 'Invalid datetime format' });
        }
        break;

      case 'number':
        schema = z.number();
        
        // Apply number constraints
        if (field.min !== undefined) {
          schema = (schema as z.ZodNumber).min(field.min, {
            message: `Must be at least ${field.min}`,
          });
        }
        if (field.max !== undefined) {
          schema = (schema as z.ZodNumber).max(field.max, {
            message: `Must be at most ${field.max}`,
          });
        }
        if (field.integer) {
          schema = (schema as z.ZodNumber).int({ message: 'Must be an integer' });
        }
        if (field.positive) {
          schema = (schema as z.ZodNumber).positive({ message: 'Must be positive' });
        }
        break;

      case 'boolean':
        schema = z.boolean();
        break;

      case 'date':
        schema = z.date();
        break;

      case 'array':
        if (field.items) {
          const itemSchema = this.buildFieldSchema(field.items);
          schema = z.array(itemSchema);
          
          if (field.minItems !== undefined) {
            schema = (schema as z.ZodArray<ZodSchema>).min(field.minItems, {
              message: `Must have at least ${field.minItems} items`,
            });
          }
          if (field.maxItems !== undefined) {
            schema = (schema as z.ZodArray<ZodSchema>).max(field.maxItems, {
              message: `Must have at most ${field.maxItems} items`,
            });
          }
        } else {
          schema = z.array(z.unknown());
        }
        break;

      case 'object':
        if (field.properties) {
          schema = this.buildZodSchema(field.properties);
        } else {
          schema = z.object({});
        }
        break;

      default:
        schema = z.unknown();
    }

    // Apply enum constraint
    if (field.enum && field.enum.length > 0) {
      schema = z.enum(field.enum as [string, ...string[]]);
    }

    // Apply custom validation
    if (field.validate) {
      schema = schema.refine(field.validate, {
        message: 'Custom validation failed',
      });
    }

    // Apply default value
    if (field.default !== undefined) {
      schema = schema.default(field.default);
    }

    // Make optional if not required
    if (!field.required) {
      schema = schema.optional();
    }

    return schema;
  }

  /**
   * Format Zod errors into ValidationError array
   */
  private formatZodErrors(error: ZodError): ValidationFieldError[] {
    // Zod errors are in the issues property
    const issues = error.issues || [];
    
    return issues.map((err) => ({
      path: err.path.map(String),
      message: err.message,
      code: err.code,
      expected: 'expected' in err ? err.expected : undefined,
      received: 'received' in err ? err.received : undefined,
    }));
  }

  /**
   * Extract Zod schema from Schema wrapper
   */
  private getZodSchema(schema: Schema<unknown>): ZodSchema {
    const zodSchema = (schema as { _zodSchema?: ZodSchema })._zodSchema;
    if (!zodSchema) {
      throw new Error('Invalid schema: missing Zod schema');
    }
    return zodSchema;
  }

  /**
   * Type guard to check if value is a FieldSchema
   */
  private isFieldSchema(value: unknown): value is FieldSchema {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      typeof (value as FieldSchema).type === 'string'
    );
  }
}
