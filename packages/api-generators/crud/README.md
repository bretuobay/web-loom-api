# @web-loom/api-generator-crud

CRUD generator for Web Loom API Framework. Automatically generates REST API endpoints for CRUD operations based on model definitions.

## Features

- Generates 6 standard REST endpoints: List, Create, Get, Update (PUT), Update (PATCH), Delete
- **Page-based pagination** with configurable page size and limits
- **Cursor-based pagination** for efficient large dataset traversal
- **Filtering** with multiple operators (eq, ne, gt, gte, lt, lte, in, like)
- **Sorting** with multiple fields (ascending/descending)
- **Field selection** (sparse fieldsets) to reduce payload size
- **Search** across multiple fields
- **Relationship loading** (coming soon)
- Soft delete support (coming soon)
- Optimistic locking support (coming soon)

## Installation

```bash
npm install @web-loom/api-generator-crud
```

## Usage

### Basic Example

```typescript
import { CRUDGenerator } from '@web-loom/api-generator-crud';
import { DrizzleAdapter } from '@web-loom/api-adapter-drizzle';
import type { ModelDefinition } from '@web-loom/api-core';

// Define your model
const UserModel: ModelDefinition = {
  name: 'User',
  tableName: 'users',
  fields: [
    { name: 'id', type: 'uuid', database: { primaryKey: true } },
    { name: 'name', type: 'string', required: true },
    { name: 'email', type: 'string', required: true },
    { name: 'createdAt', type: 'date', database: { autoGenerate: true } },
  ],
};

// Initialize database adapter
const database = new DrizzleAdapter({
  connectionString: process.env.DATABASE_URL!,
});

// Create CRUD generator
const generator = new CRUDGenerator(database);

// Generate routes with all features enabled
const routes = generator.generate(UserModel, {
  basePath: '/users',
  enablePagination: true,
  enableFiltering: true,
  enableSorting: true,
  enableFieldSelection: true,
  enableSearch: true,
  searchFields: ['name', 'email'],
  enableCursorPagination: true,
  defaultPageSize: 20,
  maxPageSize: 100,
});

// Register routes with your API framework adapter
routes.forEach((route) => {
  apiFramework.registerRoute(route.method, route.path, route.handler);
});
```

## Generated Endpoints

The CRUD generator creates the following endpoints:

### 1. List (GET /resource)

Returns a paginated list of resources with support for filtering, sorting, search, and field selection.

**Query Parameters:**

**Pagination:**

- `page` - Page number (default: 1) for page-based pagination
- `limit` - Items per page (default: 20, max: configurable)
- `cursor` - Cursor for cursor-based pagination (base64 encoded ID)

**Filtering:**

- `filter[field][operator]=value` - Filter by field with operator
- Supported operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `like`
- Examples:
  - `?filter[age][gte]=18` - Age greater than or equal to 18
  - `?filter[name][eq]=John` - Name equals John
  - `?filter[status][in]=active,pending` - Status in list

**Sorting:**

- `sort=field1,-field2` - Sort by fields (- prefix for descending)
- Examples:
  - `?sort=name` - Sort by name ascending
  - `?sort=-createdAt` - Sort by createdAt descending
  - `?sort=name,-createdAt` - Sort by name asc, then createdAt desc

**Field Selection:**

- `fields=field1,field2` - Select specific fields to return
- Example: `?fields=id,name,email` - Only return id, name, and email

**Search:**

- `search=term` - Search across configured searchFields
- Example: `?search=john` - Search for "john" in name and email fields

**Page-based Response:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

**Cursor-based Response:**

```json
{
  "data": [...],
  "pagination": {
    "cursor": "abc123",
    "nextCursor": "def456",
    "hasNextPage": true,
    "limit": 20
  }
}
```

### 2. Create (POST /resource)

Creates a new resource.

**Request Body:** Resource data (validated by middleware)

**Response:** Created resource with 201 status

### 3. Get (GET /resource/:id)

Retrieves a single resource by ID.

**Response:** Resource data or 404 if not found

### 4. Update (PUT /resource/:id)

Fully updates a resource (replaces all fields).

**Request Body:** Complete resource data

**Response:** Updated resource or 404 if not found

### 5. Update (PATCH /resource/:id)

Partially updates a resource (updates only provided fields).

**Request Body:** Partial resource data

**Response:** Updated resource or 404 if not found

### 6. Delete (DELETE /resource/:id)

Deletes a resource.

**Response:** 204 No Content or 404 if not found

## Configuration Options

```typescript
interface CRUDOptions {
  /** Base path for the resource (e.g., '/users') */
  basePath: string;

  /** Enable soft delete instead of hard delete */
  enableSoftDelete?: boolean;

  /** Enable optimistic locking for updates */
  enableOptimisticLocking?: boolean;

  /** Fields to exclude from responses */
  excludeFields?: string[];

  /** Enable pagination for list endpoint */
  enablePagination?: boolean;

  /** Default page size for pagination */
  defaultPageSize?: number;

  /** Maximum page size allowed */
  maxPageSize?: number;

  /** Enable filtering support */
  enableFiltering?: boolean;

  /** Enable sorting support */
  enableSorting?: boolean;

  /** Enable field selection support */
  enableFieldSelection?: boolean;

  /** Enable search functionality */
  enableSearch?: boolean;

  /** Fields to enable search on */
  searchFields?: string[];

  /** Enable cursor-based pagination */
  enableCursorPagination?: boolean;

  /** Enable relationship loading */
  enableRelationships?: boolean;
}
```

## Advanced Examples

### Filtering Example

```typescript
// GET /users?filter[age][gte]=18&filter[status][eq]=active
// Returns users with age >= 18 and status = active
```

### Sorting Example

```typescript
// GET /users?sort=name,-createdAt
// Returns users sorted by name ascending, then createdAt descending
```

### Field Selection Example

```typescript
// GET /users?fields=id,name,email
// Returns only id, name, and email fields (excludes password, etc.)
```

### Search Example

```typescript
const routes = generator.generate(UserModel, {
  basePath: '/users',
  enableSearch: true,
  searchFields: ['name', 'email', 'bio'],
});

// GET /users?search=john
// Searches for "john" in name, email, and bio fields
```

### Cursor Pagination Example

```typescript
// First request
// GET /users?limit=20
// Returns first 20 users with nextCursor

// Next request
// GET /users?cursor=abc123&limit=20
// Returns next 20 users after cursor
```

### Exclude Sensitive Fields

```typescript
const routes = generator.generate(UserModel, {
  basePath: '/users',
  excludeFields: ['password', 'passwordHash', 'apiKey'],
});

// Password fields are automatically excluded from all responses
```

## Advanced Features (Coming Soon)

- Nested relationship creation
- Relationship loading (include parameter)
- Soft delete support
- Optimistic locking
- Computed fields
- Aggregations (count, sum, avg)

## License

MIT
