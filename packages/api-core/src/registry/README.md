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
import { ModelRegistry } from '@web-loom/api-core';
import type { ModelDefinition } from '@web-loom/api-core';

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
registry.register(postModel); // depends on User
registry.register(userModel); // no dependencies

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
  ];
}

// ✗ Invalid
{
  fields: []; // Must have at least one field
}

{
  fields: [
    { name: 'Email', type: 'string' }, // Not camelCase
  ];
}

{
  fields: [
    { name: 'role', type: 'enum' }, // Missing enum values
  ];
}
```

### Table Name Validation

- Must be snake_case if provided (e.g., "users", "blog_posts")

```typescript
// ✓ Valid
{
  tableName: 'users';
}
{
  tableName: 'blog_posts';
}

// ✗ Invalid
{
  tableName: 'Users';
} // Not snake_case
{
  tableName: 'BlogPosts';
} // Not snake_case
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
  ];
}

// ✗ Invalid
{
  relationships: [
    { type: 'invalid', model: 'User' }, // Invalid type
  ];
}

{
  relationships: [
    { type: 'manyToMany', model: 'Tag' }, // Missing 'through' table
  ];
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
    console.log(error.fields); // Array of field-level errors
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

---

# Route Registry

The Route Registry is a central component that tracks all route handlers in the Web Loom API Framework. It provides route registration, matching with parameter extraction, and conflict detection for building REST APIs.

## Features

- **Route Registration**: Register and unregister route handlers with HTTP methods and paths
- **Dynamic Parameters**: Support for route parameters (e.g., `/users/:id`)
- **Route Matching**: Match incoming requests to registered routes and extract parameters
- **Conflict Detection**: Prevent duplicate route registration
- **Metadata Management**: Store route metadata for documentation and introspection
- **Path Normalization**: Automatic handling of trailing slashes

## Usage

### Basic Registration

```typescript
import { RouteRegistry } from '@web-loom/api-core';
import type { RouteDefinition } from '@web-loom/api-core';

const registry = new RouteRegistry();

const route: RouteDefinition = {
  path: '/users/:id',
  method: 'GET',
  handler: async (ctx) => {
    const user = await db.getUser(ctx.params.id);
    return new Response(JSON.stringify(user));
  },
  metadata: {
    description: 'Get user by ID',
    tags: ['users'],
  },
};

registry.register(route);
```

### Route Matching

```typescript
// Match a route and extract parameters
const match = registry.match('/users/123', 'GET');

if (match) {
  console.log(match.params.id); // '123'
  const response = await match.route.handler(context);
}
```

### Multiple Parameters

```typescript
registry.register({
  path: '/users/:userId/posts/:postId',
  method: 'GET',
  handler: async (ctx) => {
    const { userId, postId } = ctx.params;
    const post = await db.getPost(userId, postId);
    return new Response(JSON.stringify(post));
  },
});

const match = registry.match('/users/123/posts/456', 'GET');
// match.params = { userId: '123', postId: '456' }
```

### Route Metadata

```typescript
registry.register({
  path: '/users',
  method: 'GET',
  handler: listUsers,
  metadata: {
    description: 'List all users with pagination',
    tags: ['users', 'public'],
    deprecated: false,
    version: 'v1',
    responses: [
      {
        status: 200,
        description: 'List of users',
        schema: UserListSchema,
      },
    ],
  },
});

// Retrieve metadata
const metadata = registry.getMetadata('/users', 'GET');
console.log(metadata.description); // 'List all users with pagination'
```

### Checking Registration

```typescript
// Check if a route exists
if (registry.has('/users/:id', 'GET')) {
  console.log('Route exists');
}

// Get a specific route
const route = registry.get('/users/:id', 'GET');

// Get all routes for a path
const userRoutes = registry.getByPath('/users/:id');
// Returns routes for GET, PUT, PATCH, DELETE, etc.

// Get all registered routes
const allRoutes = registry.getAll();
```

## Route Matching

The RouteRegistry supports dynamic route parameters using the `:param` syntax:

### Static Routes

```typescript
registry.register({ path: '/users', method: 'GET', handler: getUsers });

const match = registry.match('/users', 'GET');
// match.params = {}
```

### Single Parameter

```typescript
registry.register({ path: '/users/:id', method: 'GET', handler: getUser });

const match = registry.match('/users/123', 'GET');
// match.params = { id: '123' }
```

### Multiple Parameters

```typescript
registry.register({
  path: '/users/:id/posts/:postId',
  method: 'GET',
  handler: getPost,
});

const match = registry.match('/users/123/posts/456', 'GET');
// match.params = { id: '123', postId: '456' }
```

### URL Decoding

Parameters are automatically URL-decoded:

```typescript
registry.register({ path: '/posts/:slug', method: 'GET', handler: getPost });

const match = registry.match('/posts/hello%20world', 'GET');
// match.params = { slug: 'hello world' }
```

### Path Normalization

Trailing slashes are automatically removed (except for root `/`):

```typescript
registry.register({ path: '/users/', method: 'GET', handler: getUsers });

// Both match the same route
registry.match('/users', 'GET'); // ✓ Matches
registry.match('/users/', 'GET'); // ✓ Matches
```

## Conflict Detection

The RouteRegistry prevents duplicate route registration:

```typescript
// First registration succeeds
registry.register({ path: '/users', method: 'GET', handler: getUsers });

// Second registration with same path and method throws ConflictError
try {
  registry.register({ path: '/users', method: 'GET', handler: otherHandler });
} catch (error) {
  console.log(error.message); // "Route already registered: GET /users"
}

// Different method is allowed
registry.register({ path: '/users', method: 'POST', handler: createUser });
// ✓ Success - different HTTP method
```

## Advanced Features

### Route Validation

```typescript
registry.register({
  path: '/users',
  method: 'POST',
  handler: createUser,
  validation: {
    body: UserCreateSchema,
    query: PaginationSchema,
    params: IdParamSchema,
  },
});
```

### Middleware

```typescript
registry.register({
  path: '/admin/users',
  method: 'GET',
  handler: listUsers,
  middleware: [authMiddleware, adminMiddleware],
});
```

### Authentication

```typescript
registry.register({
  path: '/profile',
  method: 'GET',
  handler: getProfile,
  auth: {
    required: true,
    roles: ['user', 'admin'],
    scopes: ['profile:read'],
  },
});
```

### Rate Limiting

```typescript
registry.register({
  path: '/api/search',
  method: 'GET',
  handler: search,
  rateLimit: {
    limit: 100,
    window: 60000, // 1 minute
  },
});
```

### Caching

```typescript
registry.register({
  path: '/api/posts',
  method: 'GET',
  handler: listPosts,
  cache: {
    ttl: 300, // 5 minutes
    perUser: false,
  },
});
```

## Error Handling

### ConflictError

Thrown when attempting to register a duplicate route:

```typescript
try {
  registry.register({ path: '/users', method: 'GET', handler: getUsers });
  registry.register({ path: '/users', method: 'GET', handler: otherHandler });
} catch (error) {
  if (error instanceof ConflictError) {
    console.log(error.message); // "Route already registered: GET /users"
  }
}
```

### NotFoundError

Thrown when attempting to unregister a non-existent route:

```typescript
try {
  registry.unregister('/nonexistent', 'GET');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(error.message); // "Route not found: GET /nonexistent"
  }
}
```

## API Reference

### Methods

#### `register(route: RouteDefinition): void`

Register a new route in the registry.

- **Throws**: `ConflictError` if a route with the same method and path already exists

#### `unregister(path: string, method: HTTPMethod): void`

Unregister a route from the registry.

- **Throws**: `NotFoundError` if the route doesn't exist

#### `get(path: string, method: HTTPMethod): RouteDefinition | undefined`

Get a route by exact path and method.

- **Returns**: The route definition, or `undefined` if not found

#### `getAll(): RouteDefinition[]`

Get all registered routes.

- **Returns**: Array of all route definitions

#### `getByPath(path: string): RouteDefinition[]`

Get all routes for a specific path (all methods).

- **Returns**: Array of route definitions for the path

#### `match(path: string, method: HTTPMethod): RouteMatch | undefined`

Match a URL path against registered routes and extract parameters.

- **Returns**: Route match with extracted parameters, or `undefined` if no match

#### `getMetadata(path: string, method: HTTPMethod): RouteMetadata`

Get metadata for a specific route.

- **Returns**: Route metadata, or empty object if not found

#### `has(path: string, method: HTTPMethod): boolean`

Check if a route exists.

- **Returns**: `true` if route exists, `false` otherwise

#### `clear(): void`

Clear all routes from the registry. Useful for testing or hot reload scenarios.

#### `size(): number`

Get the total number of registered routes.

- **Returns**: Number of routes

## Types

### RouteDefinition

```typescript
interface RouteDefinition {
  path: string;
  method: HTTPMethod;
  handler: RouteHandler;
  validation?: RouteValidation;
  middleware?: Middleware[];
  auth?: AuthRequirement;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  metadata?: RouteMetadata;
}
```

### RouteMatch

```typescript
interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
}
```

### RouteMetadata

```typescript
interface RouteMetadata {
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  version?: string;
  responses?: ResponseDefinition[];
}
```

## Examples

### Complete REST API

```typescript
const registry = new RouteRegistry();

// List users
registry.register({
  path: '/users',
  method: 'GET',
  handler: listUsers,
  metadata: { description: 'List all users' },
});

// Get user
registry.register({
  path: '/users/:id',
  method: 'GET',
  handler: getUser,
  metadata: { description: 'Get user by ID' },
});

// Create user
registry.register({
  path: '/users',
  method: 'POST',
  handler: createUser,
  validation: { body: UserCreateSchema },
  metadata: { description: 'Create a new user' },
});

// Update user
registry.register({
  path: '/users/:id',
  method: 'PUT',
  handler: updateUser,
  validation: { body: UserUpdateSchema },
  metadata: { description: 'Update user' },
});

// Delete user
registry.register({
  path: '/users/:id',
  method: 'DELETE',
  handler: deleteUser,
  metadata: { description: 'Delete user' },
});
```

## Related

- [Route Types](./route-types.ts) - TypeScript types for route definitions
- [API Framework Adapter](../interfaces/api-framework-adapter.ts) - Route handler interface
- [CRUD Generator](../../api-generator-crud/) - Uses the registry to generate CRUD routes

## Requirements

- Requirements: 5.1, 5.2, 5.3, 6.5, 6.6

---

# Route Discovery

The Route Discovery component automatically discovers and registers routes from the file system using file-based routing conventions. It scans a routes directory recursively and maps file paths to URL paths, following Next.js-style conventions.

## Features

- **Automatic Route Discovery**: Scan directories recursively for route files
- **File-Based Routing**: Map file paths to URL paths using conventions
- **Dynamic Segments**: Support `[param]` syntax for dynamic route parameters
- **Catch-All Routes**: Support `[...path]` syntax for catch-all routes
- **Nested Routes**: Automatically create nested paths from directory structure
- **HTTP Method Handlers**: Discover exported GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD functions
- **Error Handling**: Graceful error handling with detailed error messages

## File-Based Routing Conventions

### Basic Mapping

| File Path        | URL Path       |
| ---------------- | -------------- |
| `index.ts`       | `/`            |
| `users.ts`       | `/users`       |
| `about.ts`       | `/about`       |
| `users/index.ts` | `/users`       |
| `users/posts.ts` | `/users/posts` |

### Dynamic Segments

Use `[param]` syntax for dynamic route parameters:

| File Path                      | URL Path                   |
| ------------------------------ | -------------------------- |
| `[id].ts`                      | `/:id`                     |
| `users/[id].ts`                | `/users/:id`               |
| `users/[id]/posts.ts`          | `/users/:id/posts`         |
| `users/[id]/posts/[postId].ts` | `/users/:id/posts/:postId` |

### Catch-All Routes

Use `[...path]` syntax for catch-all routes:

| File Path           | URL Path  |
| ------------------- | --------- |
| `[...path].ts`      | `/*`      |
| `docs/[...path].ts` | `/docs/*` |

## Usage

### Basic Discovery

```typescript
import { RouteDiscovery, RouteRegistry } from '@web-loom/api-core';

const registry = new RouteRegistry();
const discovery = new RouteDiscovery(registry);

// Discover all routes in the src/routes directory
await discovery.discover('./src/routes');

// Routes are now registered in the registry
console.log(`Discovered ${registry.size()} routes`);
```

### Route File Structure

Route files export functions named after HTTP methods:

```typescript
// src/routes/users.ts

// GET /users - List all users
export async function GET(ctx) {
  const users = await db.users.findMany();
  return new Response(JSON.stringify(users));
}

// POST /users - Create a new user
export async function POST(ctx) {
  const data = await ctx.request.json();
  const user = await db.users.create(data);
  return new Response(JSON.stringify(user), { status: 201 });
}
```

### Dynamic Route Parameters

```typescript
// src/routes/users/[id].ts

// GET /users/:id - Get user by ID
export async function GET(ctx) {
  const { id } = ctx.params;
  const user = await db.users.findUnique({ where: { id } });

  if (!user) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(JSON.stringify(user));
}

// PUT /users/:id - Update user
export async function PUT(ctx) {
  const { id } = ctx.params;
  const data = await ctx.request.json();
  const user = await db.users.update({ where: { id }, data });
  return new Response(JSON.stringify(user));
}

// DELETE /users/:id - Delete user
export async function DELETE(ctx) {
  const { id } = ctx.params;
  await db.users.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
```

### Nested Routes

```typescript
// src/routes/users/[id]/posts/[postId].ts

// GET /users/:id/posts/:postId - Get a specific post for a user
export async function GET(ctx) {
  const { id, postId } = ctx.params;
  const post = await db.posts.findFirst({
    where: { id: postId, userId: id },
  });

  if (!post) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(JSON.stringify(post));
}
```

### Catch-All Routes

```typescript
// src/routes/docs/[...path].ts

// GET /docs/* - Serve documentation pages
export async function GET(ctx) {
  // The path parameter contains the full path after /docs/
  const docPath = ctx.params.path || 'index';
  const content = await loadDocumentation(docPath);
  return new Response(content, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

## Example Project Structure

```
src/routes/
├── index.ts              # GET /
├── about.ts              # GET /about
├── users.ts              # GET /users, POST /users
├── users/
│   ├── [id].ts          # GET /users/:id, PUT /users/:id, DELETE /users/:id
│   └── [id]/
│       └── posts.ts     # GET /users/:id/posts, POST /users/:id/posts
├── posts/
│   ├── index.ts         # GET /posts, POST /posts
│   └── [id].ts          # GET /posts/:id, PUT /posts/:id, DELETE /posts/:id
├── admin/
│   ├── dashboard.ts     # GET /admin/dashboard
│   └── settings.ts      # GET /admin/settings, PUT /admin/settings
└── [...path].ts         # GET /* (catch-all for 404 handling)
```

## Supported HTTP Methods

The RouteDiscovery looks for exported functions with these names:

- `GET` - Handle GET requests
- `POST` - Handle POST requests
- `PUT` - Handle PUT requests
- `PATCH` - Handle PATCH requests
- `DELETE` - Handle DELETE requests
- `OPTIONS` - Handle OPTIONS requests
- `HEAD` - Handle HEAD requests

```typescript
// src/routes/api.ts

export async function GET() {
  return new Response('GET');
}

export async function POST() {
  return new Response('POST');
}

export async function PUT() {
  return new Response('PUT');
}

export async function PATCH() {
  return new Response('PATCH');
}

export async function DELETE() {
  return new Response('DELETE');
}

export async function OPTIONS() {
  return new Response('OPTIONS');
}

export async function HEAD() {
  return new Response(null);
}
```

## File Filtering

The RouteDiscovery automatically filters out:

- **Test files**: `*.test.ts`, `*.spec.ts`
- **Type definitions**: `*.d.ts`
- **Non-code files**: Files without `.ts` or `.js` extension

```
src/routes/
├── users.ts              # ✓ Discovered
├── users.test.ts         # ✗ Ignored (test file)
├── users.spec.ts         # ✗ Ignored (spec file)
├── types.d.ts            # ✗ Ignored (type definition)
├── README.md             # ✗ Ignored (not a code file)
└── utils.ts              # ✓ Scanned (but no routes if no HTTP methods exported)
```

## Statistics

Get statistics about discovered routes:

```typescript
await discovery.discover('./src/routes');

const stats = discovery.getStats();

console.log(`Total routes: ${stats.totalRoutes}`);
console.log(`GET routes: ${stats.routesByMethod.GET}`);
console.log(`POST routes: ${stats.routesByMethod.POST}`);
console.log(`PUT routes: ${stats.routesByMethod.PUT}`);
console.log(`PATCH routes: ${stats.routesByMethod.PATCH}`);
console.log(`DELETE routes: ${stats.routesByMethod.DELETE}`);
console.log(`OPTIONS routes: ${stats.routesByMethod.OPTIONS}`);
console.log(`HEAD routes: ${stats.routesByMethod.HEAD}`);
```

## Error Handling

### Directory Not Found

```typescript
try {
  await discovery.discover('./non-existent-dir');
} catch (error) {
  console.error(error.message);
  // "Routes directory not found: ./non-existent-dir"
}
```

### Invalid Route File

```typescript
// src/routes/invalid.ts (syntax error)
export async function GET() { invalid syntax

// Discovery will throw with context
try {
  await discovery.discover('./src/routes');
} catch (error) {
  console.error(error.message);
  // "Failed to process route file /path/to/invalid.ts: <error details>"
}
```

### No HTTP Method Handlers

If a route file doesn't export any HTTP method handlers, a warning is logged:

```typescript
// src/routes/utils.ts
export function helper() {
  return 'helper';
}

// Warning: No HTTP method handlers found in route file for path: /utils
```

## Integration with Core Runtime

The RouteDiscovery is typically used during application initialization:

```typescript
import { CoreRuntime, RouteRegistry, RouteDiscovery } from '@web-loom/api-core';

class CoreRuntime {
  private routeRegistry: RouteRegistry;
  private routeDiscovery: RouteDiscovery;

  async initialize() {
    // Initialize registries
    this.routeRegistry = new RouteRegistry();
    this.routeDiscovery = new RouteDiscovery(this.routeRegistry);

    // Discover routes from file system
    await this.routeDiscovery.discover('./src/routes');

    // Routes are now registered and ready to use
    console.log(`Initialized with ${this.routeRegistry.size()} routes`);
  }
}
```

## API Reference

### Constructor

#### `new RouteDiscovery(registry: RouteRegistry)`

Create a new RouteDiscovery instance.

- **Parameters**:
  - `registry` - RouteRegistry instance to register discovered routes

### Methods

#### `discover(routesDir: string): Promise<void>`

Discover and register all routes from a directory.

- **Parameters**:
  - `routesDir` - Path to the routes directory (relative or absolute)
- **Throws**: Error if directory doesn't exist or route files are invalid
- **Returns**: Promise that resolves when all routes are discovered

#### `getStats(): { totalRoutes: number; routesByMethod: Record<HTTPMethod, number> }`

Get statistics about discovered routes.

- **Returns**: Object with total route count and breakdown by HTTP method

## Best Practices

### 1. Organize by Resource

Group related routes in directories:

```
src/routes/
├── users/
│   ├── index.ts         # List/create users
│   ├── [id].ts          # Get/update/delete user
│   └── [id]/
│       └── posts.ts     # User's posts
└── posts/
    ├── index.ts         # List/create posts
    └── [id].ts          # Get/update/delete post
```

### 2. Use Index Files for Collections

Use `index.ts` for collection endpoints:

```typescript
// src/routes/users/index.ts
export async function GET() {
  /* List users */
}
export async function POST() {
  /* Create user */
}

// src/routes/users/[id].ts
export async function GET() {
  /* Get user */
}
export async function PUT() {
  /* Update user */
}
export async function DELETE() {
  /* Delete user */
}
```

### 3. Keep Route Files Focused

Each route file should handle a single resource or endpoint:

```typescript
// ✓ Good - focused on user resource
// src/routes/users/[id].ts
export async function GET(ctx) {
  /* Get user */
}
export async function PUT(ctx) {
  /* Update user */
}
export async function DELETE(ctx) {
  /* Delete user */
}

// ✗ Bad - mixing multiple resources
// src/routes/api.ts
export async function GET(ctx) {
  if (ctx.path.includes('users')) {
    /* ... */
  }
  if (ctx.path.includes('posts')) {
    /* ... */
  }
}
```

### 4. Use Descriptive Directory Names

Use clear, descriptive names for directories:

```
✓ Good:
src/routes/
├── users/
├── posts/
├── comments/
└── admin/

✗ Bad:
src/routes/
├── u/
├── p/
├── c/
└── a/
```

### 5. Handle Errors Gracefully

Always handle errors in route handlers:

```typescript
// src/routes/users/[id].ts
export async function GET(ctx) {
  try {
    const { id } = ctx.params;
    const user = await db.users.findUnique({ where: { id } });

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    return new Response(JSON.stringify(user));
  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

## Related

- [Route Registry](./route-registry.ts) - Central registry for route handlers
- [Route Types](./route-types.ts) - TypeScript types for route definitions
- [Core Runtime](../runtime/) - Application initialization and lifecycle

## Requirements

- Requirements: 6.1, 6.2, 6.3, 6.4, 1.3
