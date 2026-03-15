# @web-loom/api-generator-types

TypeScript type generator for Web Loom API Framework. Generates TypeScript types, interfaces, and enums from model definitions.

## Features

- Generate TypeScript interfaces from model definitions
- Generate Create and Update types for each model
- Generate enum types with JSDoc comments
- Generate request/response types for API endpoints
- Generate utility types (DeepPartial, DeepRequired, etc.)
- Support for JSDoc comments with descriptions and examples
- Optional readonly modifiers
- Automatic type inference from field definitions

## Installation

```bash
npm install @web-loom/api-generator-types
```

## Usage

### Basic Usage

```typescript
import { TypeGenerator } from '@web-loom/api-generator-types';
import type { ModelDefinition } from '@web-loom/api-generator-types';

// Define models
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'age', type: 'number', required: false },
      { name: 'createdAt', type: 'date', required: true },
      { name: 'updatedAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'User model',
      timestamps: true,
    },
  },
];

// Create generator
const generator = new TypeGenerator({
  includeJSDoc: true,
  generateEnums: true,
  generateRequestResponseTypes: true,
  generateUtilityTypes: true,
});

// Register models
generator.registerModels(models);

// Generate types
const files = generator.generateToFiles();

// Write files to disk
for (const [filename, content] of files) {
  console.log(`Generated: ${filename}`);
  // fs.writeFileSync(path.join(outputDir, filename), content);
}
```

### Generated Output

The generator creates the following files:

#### models.ts
```typescript
/**
 * User model
 * @table users
 */
export interface User {
  id: string;
  email: string;
  name: string;
  age?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create input for User
 */
export type CreateUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Update input for User
 */
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt'>>;
```

#### enums.ts
```typescript
/**
 * User role enum
 */
export enum UserRole {
  /** Regular user */
  USER = 'user',
  /** Administrator */
  ADMIN = 'admin',
  /** Moderator */
  MODERATOR = 'moderator',
}
```

#### api.ts
```typescript
/**
 * API Response wrapper
 */
export interface APIResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * POST /users request body
 */
export type UserPOSTRequest = CreateUser;

/**
 * POST /users response
 */
export type UserPOSTResponse = User;
```

#### utils.ts
```typescript
/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Prettify type for better IDE display
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
```

### With Enums

```typescript
import { TypeGenerator } from '@web-loom/api-generator-types';
import type { EnumDefinition } from '@web-loom/api-generator-types';

const enums: EnumDefinition[] = [
  {
    name: 'UserRole',
    values: [
      { key: 'USER', value: 'user', description: 'Regular user' },
      { key: 'ADMIN', value: 'admin', description: 'Administrator' },
      { key: 'MODERATOR', value: 'moderator', description: 'Moderator' },
    ],
    metadata: {
      description: 'User role enum',
    },
  },
];

generator.registerEnums(enums);
```

### With JSDoc Comments

```typescript
const models: ModelDefinition[] = [
  {
    name: 'Post',
    fields: [
      {
        name: 'title',
        type: 'string',
        required: true,
        metadata: {
          description: 'Post title',
          example: 'My First Post',
        },
      },
      {
        name: 'status',
        type: 'enum',
        required: true,
        enum: ['draft', 'published', 'archived'],
        metadata: {
          description: 'Post status',
          example: 'published',
        },
      },
    ],
    metadata: {
      description: 'Blog post model',
      tableName: 'posts',
    },
  },
];
```

Generates:

```typescript
/**
 * Blog post model
 * @table posts
 */
export interface Post {
  /**
   * Post title
   * @example "My First Post"
   */
  title: string;
  
  /**
   * Post status
   * @example "published"
   */
  status: 'draft' | 'published' | 'archived';
}
```

### With Readonly Modifiers

```typescript
const generator = new TypeGenerator({
  readonly: true,
});
```

Generates:

```typescript
export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}
```

## Configuration Options

### TypeGeneratorOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeJSDoc` | `boolean` | `true` | Include JSDoc comments |
| `generateEnums` | `boolean` | `true` | Generate enum types |
| `generateRequestResponseTypes` | `boolean` | `true` | Generate request/response types |
| `exportFormat` | `'esm' \| 'cjs' \| 'both'` | `'esm'` | Export format |
| `readonly` | `boolean` | `false` | Add readonly modifiers |
| `generateUtilityTypes` | `boolean` | `true` | Generate utility types |

## Field Types

Supported field types and their TypeScript mappings:

| Field Type | TypeScript Type |
|------------|----------------|
| `string` | `string` |
| `number` | `number` |
| `boolean` | `boolean` |
| `date` | `Date` |
| `uuid` | `string` |
| `enum` | Union of string literals |
| `json` | `Record<string, unknown>` |
| `array` | `T[]` (where T is arrayItemType) |
| `decimal` | `number` |

## Generated Types

For each model, the generator creates:

1. **Base Interface**: The main model interface
2. **CreateType**: Input type for creating (omits id and timestamps)
3. **UpdateType**: Input type for updating (all fields optional except id)

## Utility Types

The generator includes useful utility types:

- `DeepPartial<T>`: Make all properties optional recursively
- `DeepRequired<T>`: Make all properties required recursively
- `DeepReadonly<T>`: Make all properties readonly recursively
- `Prettify<T>`: Improve type display in IDE
- `KeysOfType<T, U>`: Extract keys of specific type
- `PartialBy<T, K>`: Make specific keys optional
- `RequiredBy<T, K>`: Make specific keys required

## API Reference

### TypeGenerator

#### Methods

##### `registerModel(model: ModelDefinition): void`
Register a single model definition.

##### `registerModels(models: ModelDefinition[]): void`
Register multiple model definitions.

##### `registerEnum(enumDef: EnumDefinition): void`
Register a single enum definition.

##### `registerEnums(enums: EnumDefinition[]): void`
Register multiple enum definitions.

##### `registerRoute(route: RouteDefinition): void`
Register a single route definition.

##### `registerRoutes(routes: RouteDefinition[]): void`
Register multiple route definitions.

##### `generate(): GeneratedTypes`
Generate all types and return as object.

##### `generateToFiles(): Map<string, string>`
Generate all types and return as file map.

## Examples

See the [examples](./examples) directory for complete examples:

- [Basic Usage](./examples/basic-usage.ts)
- [With Enums](./examples/with-enums.ts)
- [With JSDoc](./examples/with-jsdoc.ts)

## License

MIT
