import { ConflictError, NotFoundError, ValidationError } from '@webloom/api-shared';
import type {
  ModelDefinition,
  ModelMetadata,
  Relationship,
  FieldDefinition,
} from './types';

/**
 * Central registry for tracking all model definitions in the application.
 * Enables CRUD generation, type generation, and other code generation features.
 * 
 * The registry is thread-safe and supports:
 * - Model registration and unregistration
 * - Relationship tracking between models
 * - Dependency resolution for initialization order
 * - Model definition validation
 */
export class ModelRegistry {
  private models: Map<string, ModelDefinition> = new Map();
  private isLocked: boolean = false;

  /**
   * Register a model definition in the registry.
   * Validates the model and prevents duplicate registration.
   * 
   * @param model - The model definition to register
   * @throws {ValidationError} If the model definition is invalid
   * @throws {ConflictError} If a model with the same name already exists
   */
  register(model: ModelDefinition): void {
    // Simple lock for thread-safe registration
    while (this.isLocked) {
      // Wait for lock to be released
    }
    this.isLocked = true;

    try {
      // Validate model definition
      this.validateModel(model);

      // Check for duplicate registration
      if (this.models.has(model.name)) {
        throw new ConflictError(
          `Model "${model.name}" is already registered. Use unregister() first to replace it.`
        );
      }

      // Validate relationships reference existing models (except self-references)
      if (model.relationships) {
        for (const rel of model.relationships) {
          if (rel.model !== model.name && !this.models.has(rel.model)) {
            // Allow forward references - they'll be validated later
            // This is necessary for circular dependencies
          }
        }
      }

      // Register the model
      this.models.set(model.name, model);
    } finally {
      this.isLocked = false;
    }
  }

  /**
   * Unregister a model from the registry.
   * 
   * @param modelName - The name of the model to unregister
   * @throws {NotFoundError} If the model doesn't exist
   */
  unregister(modelName: string): void {
    while (this.isLocked) {
      // Wait for lock to be released
    }
    this.isLocked = true;

    try {
      if (!this.models.has(modelName)) {
        throw new NotFoundError(`Model "${modelName}" is not registered.`);
      }

      this.models.delete(modelName);
    } finally {
      this.isLocked = false;
    }
  }

  /**
   * Retrieve a model definition by name.
   * 
   * @param modelName - The name of the model to retrieve
   * @returns The model definition, or undefined if not found
   */
  get(modelName: string): ModelDefinition | undefined {
    return this.models.get(modelName);
  }

  /**
   * Retrieve all registered model definitions.
   * 
   * @returns Array of all model definitions
   */
  getAll(): ModelDefinition[] {
    return Array.from(this.models.values());
  }

  /**
   * Check if a model is registered.
   * 
   * @param modelName - The name of the model to check
   * @returns True if the model exists, false otherwise
   */
  has(modelName: string): boolean {
    return this.models.has(modelName);
  }

  /**
   * Get all relationships for a specific model.
   * 
   * @param modelName - The name of the model
   * @returns Array of relationships, or empty array if model not found
   */
  getRelationships(modelName: string): Relationship[] {
    const model = this.models.get(modelName);
    return model?.relationships || [];
  }

  /**
   * Get all model dependencies based on relationships.
   * Returns models that this model depends on (belongsTo relationships).
   * Used for determining initialization order.
   * 
   * @param modelName - The name of the model
   * @returns Array of model names this model depends on
   */
  getDependencies(modelName: string): string[] {
    const model = this.models.get(modelName);
    if (!model || !model.relationships) {
      return [];
    }

    // Dependencies are models referenced in belongsTo relationships
    // These must be initialized before the current model
    const dependencies = model.relationships
      .filter((rel) => rel.type === 'belongsTo')
      .map((rel) => rel.model)
      .filter((name) => name !== modelName); // Exclude self-references

    return Array.from(new Set(dependencies)); // Remove duplicates
  }

  /**
   * Get metadata for a specific model.
   * 
   * @param modelName - The name of the model
   * @returns Model metadata, or empty object if model not found
   */
  getMetadata(modelName: string): ModelMetadata {
    const model = this.models.get(modelName);
    return model?.metadata || {};
  }

  /**
   * Resolve model initialization order based on dependencies.
   * Uses topological sort to determine the correct order.
   * 
   * @returns Array of model names in initialization order
   * @throws {ValidationError} If circular dependencies are detected
   */
  resolveDependencyOrder(): string[] {
    const allModels = Array.from(this.models.keys());
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (modelName: string, path: string[] = []): void => {
      if (visited.has(modelName)) {
        return;
      }

      if (visiting.has(modelName)) {
        const cycle = [...path, modelName].join(' -> ');
        throw new ValidationError(
          `Circular dependency detected: ${cycle}`,
          []
        );
      }

      visiting.add(modelName);
      const dependencies = this.getDependencies(modelName);

      for (const dep of dependencies) {
        if (!this.models.has(dep)) {
          throw new ValidationError(
            `Model "${modelName}" depends on "${dep}" which is not registered.`,
            []
          );
        }
        visit(dep, [...path, modelName]);
      }

      visiting.delete(modelName);
      visited.add(modelName);
      order.push(modelName);
    };

    for (const modelName of allModels) {
      visit(modelName);
    }

    return order;
  }

  /**
   * Validate a model definition.
   * Checks for required fields and valid configuration.
   * 
   * @param model - The model definition to validate
   * @throws {ValidationError} If the model is invalid
   */
  private validateModel(model: ModelDefinition): void {
    const errors: Array<{ path: string[]; message: string; code: string }> = [];

    // Validate model name
    if (!model.name || typeof model.name !== 'string') {
      errors.push({
        path: ['name'],
        message: 'Model name is required and must be a string',
        code: 'MISSING_FIELD',
      });
    } else if (!/^[A-Z][a-zA-Z0-9]*$/.test(model.name)) {
      errors.push({
        path: ['name'],
        message: 'Model name must be PascalCase (e.g., "User", "BlogPost")',
        code: 'INVALID_FORMAT',
      });
    }

    // Validate fields
    if (!model.fields || !Array.isArray(model.fields)) {
      errors.push({
        path: ['fields'],
        message: 'Model must have a fields array',
        code: 'MISSING_FIELD',
      });
    } else if (model.fields.length === 0) {
      errors.push({
        path: ['fields'],
        message: 'Model must have at least one field',
        code: 'INVALID_INPUT',
      });
    } else {
      // Validate each field
      const fieldNames = new Set<string>();
      model.fields.forEach((field, index) => {
        this.validateField(field, index, fieldNames, errors);
      });
    }

    // Validate relationships
    if (model.relationships) {
      if (!Array.isArray(model.relationships)) {
        errors.push({
          path: ['relationships'],
          message: 'Relationships must be an array',
          code: 'INVALID_INPUT',
        });
      } else {
        model.relationships.forEach((rel, index) => {
          this.validateRelationship(rel, index, errors);
        });
      }
    }

    // Validate table name if provided
    if (model.tableName !== undefined) {
      if (typeof model.tableName !== 'string') {
        errors.push({
          path: ['tableName'],
          message: 'Table name must be a string',
          code: 'INVALID_INPUT',
        });
      } else if (!/^[a-z][a-z0-9_]*$/.test(model.tableName)) {
        errors.push({
          path: ['tableName'],
          message: 'Table name must be snake_case (e.g., "users", "blog_posts")',
          code: 'INVALID_FORMAT',
        });
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `Model "${model.name || 'unknown'}" validation failed`,
        errors
      );
    }
  }

  /**
   * Validate a field definition.
   */
  private validateField(
    field: FieldDefinition,
    index: number,
    fieldNames: Set<string>,
    errors: Array<{ path: string[]; message: string; code: string }>
  ): void {
    const fieldPath = ['fields', index.toString()];

    // Validate field name
    if (!field.name || typeof field.name !== 'string') {
      errors.push({
        path: [...fieldPath, 'name'],
        message: 'Field name is required and must be a string',
        code: 'MISSING_FIELD',
      });
    } else {
      // Check for duplicate field names
      if (fieldNames.has(field.name)) {
        errors.push({
          path: [...fieldPath, 'name'],
          message: `Duplicate field name "${field.name}"`,
          code: 'DUPLICATE_RESOURCE',
        });
      }
      fieldNames.add(field.name);

      // Validate field name format
      if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
        errors.push({
          path: [...fieldPath, 'name'],
          message: 'Field name must be camelCase (e.g., "email", "firstName")',
          code: 'INVALID_FORMAT',
        });
      }
    }

    // Validate field type
    const validTypes = ['string', 'number', 'boolean', 'date', 'uuid', 'enum', 'json', 'array', 'decimal'];
    if (!field.type || !validTypes.includes(field.type)) {
      errors.push({
        path: [...fieldPath, 'type'],
        message: `Field type must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_INPUT',
      });
    }

    // Validate enum fields have enum values
    if (field.type === 'enum' && (!field.validation?.enum || field.validation.enum.length === 0)) {
      errors.push({
        path: [...fieldPath, 'validation', 'enum'],
        message: 'Enum fields must specify allowed values in validation.enum',
        code: 'MISSING_FIELD',
      });
    }
  }

  /**
   * Validate a relationship definition.
   */
  private validateRelationship(
    rel: Relationship,
    index: number,
    errors: Array<{ path: string[]; message: string; code: string }>
  ): void {
    const relPath = ['relationships', index.toString()];

    // Validate relationship type
    const validTypes = ['hasOne', 'hasMany', 'belongsTo', 'manyToMany'];
    if (!rel.type || !validTypes.includes(rel.type)) {
      errors.push({
        path: [...relPath, 'type'],
        message: `Relationship type must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_INPUT',
      });
    }

    // Validate model reference
    if (!rel.model || typeof rel.model !== 'string') {
      errors.push({
        path: [...relPath, 'model'],
        message: 'Relationship must reference a model name',
        code: 'MISSING_FIELD',
      });
    }

    // Validate manyToMany has through table
    if (rel.type === 'manyToMany' && !rel.through) {
      errors.push({
        path: [...relPath, 'through'],
        message: 'manyToMany relationships must specify a "through" table',
        code: 'MISSING_FIELD',
      });
    }
  }

  /**
   * Clear all registered models.
   * Useful for testing and hot reload scenarios.
   */
  clear(): void {
    while (this.isLocked) {
      // Wait for lock to be released
    }
    this.isLocked = true;

    try {
      this.models.clear();
    } finally {
      this.isLocked = false;
    }
  }
}
