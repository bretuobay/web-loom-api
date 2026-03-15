# @web-loom/api-generator-crud

CRUD generator for Web Loom API Framework. Automatically generates REST API endpoints for CRUD operations based on model definitions.

## Features

- Generates 6 standard REST endpoints: List, Create, Get, Update (PUT), Update (PATCH), Delete
- Pagination support with configurable page size and limits
- Customizable base paths
- Soft delete support (coming soon)
- Optimistic locking support (coming soon)
- Field exclusion from responses (coming soon)

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

// Generate routes
const routes = generator.generate(UserModel, {
  basePath: '/users',
  enablePagination: true,
  defaultPageSize: 20,
  maxPageSize: 100,
});

// Register routes with your API framework adapter
routes.forEach(route => {
  apiFramework.registerRoute(route.method, route.path, route.handler);
});
```

## Generated Endpoints

The CRUD generator creates the following endpoints:

### 1. List (GET /resource)

Returns a paginated list of resources.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: configurable)

**Response:**
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
}
```

## Advanced Features (Coming Soon)

- Filtering with operators (eq, gte, lte, like, in)
- Sorting with multiple fields
- Field selection (sparse fieldsets)
- Search functionality
- Relationship loading (include parameter)
- Nested relationship creation
- Soft delete support
- Optimistic locking

## License

MIT
