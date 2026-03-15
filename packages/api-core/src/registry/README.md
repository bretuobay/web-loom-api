# Model Registry

The Model Registry is a central component that tracks all model definitions in the Web Loom API Framework. It enables CRUD generation, type generation, and other code generation features by maintaining a catalog of all data models in the application.

## Features

- **Model Registration**: Register and unregister model definitions with validation
- **Thread-Safe Operations**: Concurrent access protection using locks
- **Relationship Tracking**: Track relationships between models (hasOne, hasMany, belongsTo, manyToMany)
- **Dependency Resolution**: Determine model initialization order based on relationships
- **Validation**: Comprehensive validation of model definitions at registration time
- **Metadata Management**: Store and retrieve model metadata for documentation

## Usage

### Basic Registration

```typescript
import { ModelRegistry } from '@webloom/api-core';
import type { ModelDefinition } from '@webloom/api-core';

const registry = new ModelRegistry();

const userModel: ModelDefinition = {
  name: 'User',
  tableName: 'users',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true },
    },
    {
      name: 'email',
      type: 'string',
      validation: { required: true, email: true },
      database: { unique: true },
    },
  ],
  options: {
    timestamps: true,
    crud: true,
  },
};

registry.register(userModel);
```

### Checking Registration

```typescript
// Check if a model is registered
if (registry.has('User')) {
  console.log('User model is registered');
}

// Get a specific model
const user = registry.get('User');

// Get all registered models
const allModels = registry.getAll();
```

### Relationships

```typescript
const postModel: ModelDefinition = {
  name: 'Post',
  fields: [
    { name: 'id', type: 'uuid' },
    { name: 'title', type: 'string' },
    { name: 'userId', type: 'uuid' },
  ],
  relationships: [
    {
      type: 'belongsTo',
      model: 'User',
      foreignKey: 'userId',
      as: 'author',
    },
  ],
};

registry.register(postModel);

// Get relationships for a model
const relationships = registry.getRelationships('Post');
// Returns: [{ type: 'belongsTo', model: 'User', foreignKey: 'userId', as: 'author' }]

// Get dependencies (models this model depends on)
const dependencies = registry.getDependencies('Post');
// Returns: ['User']
```

### Dependency Resolution

The registry can determine the correct initialization order for models based on their relationships:

```typescript
// Register models in any order
registry.register(commentModel); // depends on Post and User
registry.register(postModel);    // depends on User
registry.register(userModel);    // no dependencies

// Resolve initialization order
const order = registry.resolveDependencyOrder();
// Returns: ['User', 'Post', 'Comment']
```

This ensures that models are initialized in the correct order, with dependencies initialized before dependent models.

### Metadata

```typescript
const model: ModelDefinition = {
  name: 'User',
  fields: [{ name: 'id', type: 'uuid' }],
  metadata: {
    description: 'User account model',
    tags: ['auth', 'user'],
    version: '1.0.0',
  },
};

registry.register(model);

const metadata = registry.getMetadata('User');
// Returns: { description: 'User account model', tags: ['auth', 'user'], version: '1.0.0' }
```

## Validation

The registry validates model definitions at registration time:

### Model Name Validation

- Must be a non-empty string
- Must be PascalCase (e.g., "User", "BlogPost")

```typescript
// ✓ Valid
registry.register({ name: 'User', fields: [...] });
registry.register({ name: 'BlogPost', fields: [...] });

// ✗ Invalid
registry.register({ name: 'user', fields: [...] });      // Not PascalCase
registry.register({ name: 'blog_post', fields: [...] }); // Not PascalCase
```

### Field Validation

- Must have at least one field
- Field names must be camelCase (e.g., "email", "firstName")
- Field types must be valid: string, number, boolean, date, uuid, enum, json, array, decimal
- Enum fields must specify allowed values in `validation.enum`
- No duplicate field names

```typescript
// ✓ Valid
{
  fields: [
    { name: 'email', type: 'string' },
    { name: 'firstName', type: 'string' },
    { name: 'role', type: 'enum', validation: { enum: ['admin', 'user'] } },
  ]
}

// ✗ Invalid
{
  fields: [] // Must have at least one field
}

{
  fields: [
    { name: 'Email', type: 'string' } // Not camelCase
  ]
}

{
  fields: [
    { name: 'role', type: 'enum' } // Missing enum values
  ]
}
```

### Table Name Validation

- Must be snake_case if provided (e.g., "users", "blog_posts")

```typescript
// ✓ Valid
{ tableName: 'users' }
{ tableName: 'blog_posts' }

// ✗ Invalid
{ tableName: 'Users' }      // Not snake_case
{ tableName: 'BlogPosts' }  // Not snake_case
```

### Relationship Validation

- Relationship type must be: hasOne, hasMany, belongsTo, or manyToMany
- Must reference a model name
- manyToMany relationships must specify a `through` table

```typescript
// ✓ Valid
{
  relationships: [
    { type: 'belongsTo', model: 'User' },
    { type: 'manyToMany', model: 'Tag', through: 'post_tags' },
  ]
}

// ✗ Invalid
{
  relationships: [
    { type: 'invalid', model: 'User' } // Invalid type
  ]
}

{
  relationships: [
    { type: 'manyToMany', model: 'Tag' } // Missing 'through' table
  ]
}
```

## Error Handling

The registry throws specific errors for different failure scenarios:

### ValidationError

Thrown when a model definition is invalid:

```typescript
try {
  registry.register({
    name: 'invalid',
    fields: [],
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.message); // "Model "invalid" validation failed"
    console.log(error.fields);  // Array of field-level errors
  }
}
```

### ConflictError

Thrown when attempting to register a model that already exists:

```typescript
registry.register(userModel);

try {
  registry.register(userModel); // Duplicate
} catch (error) {
  if (error instanceof ConflictError) {
    console.log(error.message); // "Model "User" is already registered..."
  }
}
```

### NotFoundError

Thrown when attempting to unregister a non-existent model:

```typescript
try {
  registry.unregister('NonExistent');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(error.message); // "Model "NonExistent" is not registered."
  }
}
```

## Thread Safety

The registry uses a simple locking mechanism to ensure thread-safe operations:

```typescript
// Multiple concurrent registrations are safe
Promise.all([
  Promise.resolve(registry.register(model1)),
  Promise.resolve(registry.register(model2)),
  Promise.resolve(registry.register(model3)),
]);
```

## API Reference

### Methods

#### `register(model: ModelDefinition): void`

Register a model definition in the registry.

- **Throws**: `ValidationError` if the model is invalid
- **Throws**: `ConflictError` if the model already exists

#### `unregister(modelName: string): void`

Unregister a model from the registry.

- **Throws**: `NotFoundError` if the model doesn't exist

#### `get(modelName: string): ModelDefinition | undefined`

Retrieve a model definition by name.

- **Returns**: The model definition, or `undefined` if not found

#### `getAll(): ModelDefinition[]`

Retrieve all registered model definitions.

- **Returns**: Array of all model definitions

#### `has(modelName: string): boolean`

Check if a model is registered.

- **Returns**: `true` if the model exists, `false` otherwise

#### `getRelationships(modelName: string): Relationship[]`

Get all relationships for a specific model.

- **Returns**: Array of relationships, or empty array if model not found

#### `getDependencies(modelName: string): string[]`

Get all model dependencies based on belongsTo relationships.

- **Returns**: Array of model names this model depends on

#### `getMetadata(modelName: string): ModelMetadata`

Get metadata for a specific model.

- **Returns**: Model metadata, or empty object if model not found

#### `resolveDependencyOrder(): string[]`

Resolve model initialization order based on dependencies.

- **Returns**: Array of model names in initialization order
- **Throws**: `ValidationError` if circular dependencies are detected
- **Throws**: `ValidationError` if a dependency is not registered

#### `clear(): void`

Clear all registered models. Useful for testing and hot reload scenarios.

## Examples

See `examples/model-registry-example.ts` for a complete working example demonstrating all features.

## Related

- [Model Definition Types](./types.ts) - TypeScript types for model definitions
- [CRUD Generator](../../api-generator-crud/) - Uses the registry to generate CRUD routes
- [Type Generator](../../api-generator-types/) - Uses the registry to generate TypeScript types
