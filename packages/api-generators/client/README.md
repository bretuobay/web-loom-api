# @web-loom/api-generator-client

TypeScript client generator for Web Loom API Framework. Generates type-safe API clients with automatic serialization, error handling, retry logic, and request cancellation.

## Features

- Generate type-safe TypeScript API clients from model and route definitions
- Automatic TypeScript interface generation from models
- Type-safe method generation for all API endpoints
- Built-in error handling with custom error classes
- Automatic retry logic with exponential backoff
- Request/response interceptors
- Request cancellation support
- Automatic serialization/deserialization (Date objects, etc.)
- Optional React hooks generation (useQuery, useMutation)
- Pagination support for list endpoints
- Authentication token management
- JSDoc comments for better IDE support

## Installation

```bash
npm install @web-loom/api-generator-client
```

## Usage

### Basic Usage

```typescript
import { ClientGenerator } from '@web-loom/api-generator-client';
import type { ModelDefinition, RouteDefinition } from '@web-loom/api-generator-client';

// Define models
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'createdAt', type: 'date', required: true },
    ],
  },
];

// Define routes
const routes: RouteDefinition[] = [
  { path: '/users', method: 'GET' },
  { path: '/users', method: 'POST' },
  { path: '/users/:id', method: 'GET' },
  { path: '/users/:id', method: 'PUT' },
  { path: '/users/:id', method: 'DELETE' },
];

// Create generator
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
  includeRetry: true,
  generateErrors: true,
});

// Register models and routes
generator.registerModels(models);
generator.registerRoutes(routes);

// Generate client files
const files = generator.generateToFiles();

// Write files to disk
for (const [filename, content] of files) {
  console.log(`Generated: ${filename}`);
  // fs.writeFileSync(path.join(outputDir, filename), content);
}
```

### Using the Generated Client

```typescript
import { APIClient } from './generated';

// Create client instance
const client = new APIClient('https://api.example.com');

// Set authentication token
client.setAuthToken('your-jwt-token');

// Make API calls with full type safety
const users = await client.getUsers({ page: 1, limit: 20 });
// users is typed as PaginatedResponse<User>

const user = await client.getUserById('user-id');
// user is typed as User

const newUser = await client.createUsers({
  email: 'user@example.com',
  name: 'John Doe',
});
// newUser is typed as User

await client.deleteUserById('user-id');
// Returns void
```

### With Interceptors

```typescript
const client = new APIClient('https://api.example.com');

// Add request interceptor
client.addRequestInterceptor(async (config) => {
  // Add custom headers
  config.headers = {
    ...config.headers,
    'X-Custom-Header': 'value',
  };
  return config;
});

// Add response interceptor
client.addResponseInterceptor(async (response) => {
  // Log all responses
  console.log('Response:', response.status);
  return response;
});
```

### With Request Cancellation

```typescript
const controller = new AbortController();

// Make cancellable request
const promise = client.getUsers({ page: 1 }, { signal: controller.signal });

// Cancel the request
controller.abort();
```

### Automatic Serialization/Deserialization

The client automatically handles serialization and deserialization of special types:

```typescript
// Dates are automatically serialized to ISO strings
const post = await client.createPosts({
  title: 'My Post',
  publishedAt: new Date(), // Automatically converted to ISO string
});

// Dates in responses are automatically deserialized to Date objects
const user = await client.getUserById('user-id');
console.log(user.createdAt instanceof Date); // true
console.log(user.createdAt.toLocaleDateString()); // Works!

// Works with nested objects and arrays
const posts = await client.getPosts();
posts.data.forEach((post) => {
  console.log(post.createdAt.getFullYear()); // Date methods work
});
```

The serialization/deserialization handles:

- Date objects ↔ ISO 8601 strings
- Nested objects and arrays
- Preserves null and undefined values

### React Hooks (Optional)

Generate React hooks for your API endpoints:

```typescript
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
  generateReactHooks: true, // Enable React hooks
});
```

This generates `useQuery` hooks for GET endpoints and `useMutation` hooks for POST/PUT/PATCH/DELETE:

```typescript
import { APIClient } from './generated';
import { useGetUsers, useCreateUsers, useUpdateUserById } from './generated/hooks';

const client = new APIClient('https://api.example.com');

function UsersList() {
  // useQuery hook - auto-fetches on mount
  const { data, isLoading, error, refetch } = useGetUsers(client, {
    page: 1,
    limit: 20,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {data?.data.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

function CreateUserForm() {
  // useMutation hook - manual trigger
  const { mutate, isLoading, error } = useCreateUsers(client, {
    onSuccess: (user) => {
      console.log('User created:', user);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mutate({
      data: {
        email: 'user@example.com',
        name: 'John Doe',
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create User'}
      </button>
      {error && <div>{error.message}</div>}
    </form>
  );
}
```

Query hooks support:

- Automatic fetching on mount
- Loading and error states
- Manual refetch
- Auto-refetch intervals
- Conditional fetching
- Request cancellation on unmount

Mutation hooks support:

- Loading and error states
- Success/error callbacks
- Manual trigger
- Reset state

## Configuration Options

### ClientGeneratorOptions

| Option                | Type                       | Default       | Description                                  |
| --------------------- | -------------------------- | ------------- | -------------------------------------------- |
| `className`           | `string`                   | `'APIClient'` | Name of the generated client class           |
| `baseUrl`             | `string`                   | `''`          | Default base URL for API requests            |
| `includeFetch`        | `boolean`                  | `true`        | Include fetch implementation                 |
| `generateErrors`      | `boolean`                  | `true`        | Generate custom error classes                |
| `includeInterceptors` | `boolean`                  | `true`        | Add request/response interceptors            |
| `includeRetry`        | `boolean`                  | `true`        | Add automatic retry logic                    |
| `includeCancellation` | `boolean`                  | `true`        | Add request cancellation support             |
| `includeJSDoc`        | `boolean`                  | `true`        | Include JSDoc comments                       |
| `generateReactHooks`  | `boolean`                  | `false`       | Generate React hooks (useQuery, useMutation) |
| `exportFormat`        | `'esm' \| 'cjs' \| 'both'` | `'esm'`       | Export format                                |

## Generated Files

The generator creates the following files:

### types.ts

- TypeScript interfaces for all models
- Request/response type definitions
- Pagination types
- Error response types

### client.ts

- Main API client class
- Type-safe methods for all endpoints
- Authentication management
- Interceptor support
- Retry logic

### errors.ts

- Custom error classes
- `APIError` - Base error class
- `ValidationError` - 400 errors
- `UnauthorizedError` - 401 errors
- `NotFoundError` - 404 errors

### utils.ts

- Utility functions
- Query string builder
- Helper methods

### hooks.ts (optional)

- React hooks for queries and mutations
- `useQuery` hooks for GET endpoints
- `useMutation` hooks for POST/PUT/PATCH/DELETE
- Loading and error states
- Auto-fetch and manual trigger support

### index.ts

- Exports all generated code

## Error Handling

The generated client includes comprehensive error handling:

```typescript
try {
  const user = await client.getUserById('invalid-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('User not found');
  } else if (error instanceof ValidationError) {
    console.log('Validation failed:', error.details);
  } else if (error instanceof UnauthorizedError) {
    console.log('Authentication required');
  } else if (error instanceof APIError) {
    console.log('API error:', error.status, error.code);
  }
}
```

## Retry Logic

The client automatically retries failed requests with exponential backoff:

- Retries on status codes: 408, 429, 500, 502, 503, 504
- Maximum 3 retries
- Exponential backoff: 1s, 2s, 4s (capped at 10s)
- Configurable via options

## Type Safety

All generated methods are fully type-safe:

```typescript
// TypeScript knows the exact shape of the data
const user: User = await client.getUserById('id');

// TypeScript validates request bodies
await client.createUsers({
  email: 'test@example.com', // ✓ Valid
  name: 'Test User', // ✓ Valid
  invalid: 'field', // ✗ TypeScript error
});

// TypeScript validates query parameters
await client.getUsers({
  page: 1, // ✓ Valid
  limit: 20, // ✓ Valid
  invalid: 123, // ✗ TypeScript error
});
```

## API Reference

### ClientGenerator

#### Methods

##### `registerModel(model: ModelDefinition): void`

Register a single model definition.

##### `registerModels(models: ModelDefinition[]): void`

Register multiple model definitions.

##### `registerRoute(route: RouteDefinition): void`

Register a single route definition.

##### `registerRoutes(routes: RouteDefinition[]): void`

Register multiple route definitions.

##### `generate(): GeneratedClient`

Generate all client code and return as object.

##### `generateToFiles(): Map<string, string>`

Generate all client code and return as file map.

## Examples

See the [examples](./examples) directory for complete examples:

- [Basic Usage](./examples/basic-usage.ts)
- [With Authentication](./examples/with-auth.ts)
- [With Interceptors](./examples/with-interceptors.ts)
- [With Serialization](./examples/with-serialization.ts)
- [With React Hooks](./examples/with-react-hooks.ts)

## License

MIT
