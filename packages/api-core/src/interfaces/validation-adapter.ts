/**
 * Validation Adapter Interface
 * 
 * Abstracts validation libraries (e.g., Zod, Yup, Joi) to provide a unified
 * interface for schema definition, data validation, and schema operations.
 * 
 * This adapter enables the framework to support multiple validation libraries,
 * allowing developers to choose their preferred validation approach.
 * 
 * **Default Implementation:** Zod (runtime type validation with TypeScript inference)
 * **Alternative Implementations:** Yup, Joi, AJV (JSON Schema)
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
 * 
 * **Requirements:** 2.3, 7.1, 7.5, 7.6, 7.7
 */
export interface ValidationAdapter {
  /**
   * Define a validation schema from a schema definition
   * 
   * Creates a reusable schema object that can validate data against
   * the specified rules and constraints.
   * 
   * @param definition - Schema definition with field types and constraints
   * @returns Schema object for validation
   * 
   * @example
   * ```typescript
   * const schema = adapter.defineSchema({
   *   name: { type: 'string', minLength: 2, maxLength: 100 },
   *   email: { type: 'string', format: 'email' },
   *   age: { type: 'number', min: 0, integer: true }
   * });
   * ```
   */
  defineSchema<T>(definition: SchemaDefinition): Schema<T>;

  /**
   * Validate data against a schema synchronously
   * 
   * Checks if data conforms to the schema rules and returns detailed
   * validation results with field-level errors.
   * 
   * @param schema - Schema to validate against
   * @param data - Data to validate
   * @returns Validation result with success flag, data, and errors
   * 
   * @example
   * ```typescript
   * const result = adapter.validate(userSchema, {
   *   name: 'John',
   *   email: 'invalid-email',
   *   age: -5
   * });
   * 
   * if (!result.success) {
   *   console.error('Validation errors:', result.errors);
   *   // [
   *   //   { path: ['email'], message: 'Invalid email format', code: 'invalid_format' },
   *   //   { path: ['age'], message: 'Must be at least 0', code: 'too_small' }
   *   // ]
   * }
   * ```
   */
  validate<T>(schema: Schema<T>, data: unknown): ValidationResult<T>;

  /**
   * Validate data against a schema asynchronously
   * 
   * Supports async validation rules (e.g., database uniqueness checks,
   * external API validation). Returns a Promise with validation results.
   * 
   * @param schema - Schema to validate against
   * @param data - Data to validate
   * @returns Promise resolving to validation result
   * 
   * @example
   * ```typescript
   * const result = await adapter.validateAsync(userSchema, {
   *   email: 'user@example.com'
   * });
   * ```
   */
  validateAsync<T>(schema: Schema<T>, data: unknown): Promise<ValidationResult<T>>;

  /**
   * Merge two schemas into a single schema
   * 
   * Combines field definitions from both schemas. Useful for composing
   * schemas from reusable parts.
   * 
   * @param schema1 - First schema
   * @param schema2 - Second schema
   * @returns Merged schema containing fields from both
   * 
   * @example
   * ```typescript
   * const baseSchema = adapter.defineSchema({ id: { type: 'string' } });
   * const userSchema = adapter.defineSchema({ name: { type: 'string' } });
   * const fullSchema = adapter.merge(baseSchema, userSchema);
   * // Result: { id: string, name: string }
   * ```
   */
  merge<T, U>(schema1: Schema<T>, schema2: Schema<U>): Schema<T & U>;

  /**
   * Create a schema with all fields optional
   * 
   * Converts a schema to make all fields optional. Useful for update
   * operations where only some fields may be provided.
   * 
   * @param schema - Original schema
   * @returns Schema with all fields optional
   * 
   * @example
   * ```typescript
   * const createSchema = adapter.defineSchema({
   *   name: { type: 'string', required: true },
   *   email: { type: 'string', required: true }
   * });
   * 
   * const updateSchema = adapter.partial(createSchema);
   * // All fields now optional for PATCH operations
   * ```
   */
  partial<T>(schema: Schema<T>): Schema<Partial<T>>;

  /**
   * Create a schema with only specified fields
   * 
   * Extracts a subset of fields from a schema. Useful for creating
   * schemas for specific operations or API responses.
   * 
   * @param schema - Original schema
   * @param keys - Field names to include
   * @returns Schema containing only specified fields
   * 
   * @example
   * ```typescript
   * const fullSchema = adapter.defineSchema({
   *   id: { type: 'string' },
   *   name: { type: 'string' },
   *   email: { type: 'string' },
   *   password: { type: 'string' }
   * });
   * 
   * const publicSchema = adapter.pick(fullSchema, ['id', 'name', 'email']);
   * // Excludes password from public API responses
   * ```
   */
  pick<T, K extends keyof T>(schema: Schema<T>, keys: K[]): Schema<Pick<T, K>>;
}

/**
 * Schema object for validation
 * 
 * Opaque type representing a validation schema. The actual implementation
 * is adapter-specific (e.g., Zod schema, Yup schema).
 * 
 * @template T - TypeScript type that the schema validates
 */
export interface Schema<T> {
  /** Internal type marker (not used at runtime) */
  _type?: T;
}

/**
 * Schema definition for creating validation schemas
 * 
 * Defines field types, constraints, and validation rules in a
 * framework-agnostic format.
 */
export interface SchemaDefinition {
  /** Field definitions keyed by field name */
  [key: string]: FieldSchema | unknown;
}

/**
 * Field schema definition
 */
export interface FieldSchema {
  /** Field type (string, number, boolean, date, array, object) */
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  
  /** Whether field is required */
  required?: boolean;
  
  /** String constraints */
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'url' | 'uuid' | 'date' | 'datetime';
  
  /** Number constraints */
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
  
  /** Array constraints */
  items?: FieldSchema;
  minItems?: number;
  maxItems?: number;
  
  /** Object constraints */
  properties?: SchemaDefinition;
  
  /** Enum values */
  enum?: unknown[];
  
  /** Default value */
  default?: unknown;
  
  /** Custom validation function */
  validate?: (value: unknown) => boolean | string;
}

/**
 * Validation result
 * 
 * Contains the outcome of validation with parsed data or error details.
 * 
 * @template T - Type of validated data
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  
  /** Validated and parsed data (only present if success is true) */
  data?: T;
  
  /** Validation errors (only present if success is false) */
  errors?: ValidationError[];
}

/**
 * Validation error for a specific field
 * 
 * Provides detailed information about why validation failed,
 * including the field path and error message.
 */
export interface ValidationError {
  /** 
   * Field path as array of keys
   * 
   * @example
   * ['user', 'email'] for nested field user.email
   * ['items', '0', 'name'] for array item items[0].name
   */
  path: string[];
  
  /** Human-readable error message */
  message: string;
  
  /** Machine-readable error code (e.g., 'invalid_type', 'too_small') */
  code: string;
  
  /** Expected value or constraint (optional) */
  expected?: unknown;
  
  /** Received value that failed validation (optional) */
  received?: unknown;
}
