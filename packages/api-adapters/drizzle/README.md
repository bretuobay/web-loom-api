# @web-loom/api-adapter-drizzle

Drizzle ORM adapter for Web Loom API Framework. Provides database connectivity using Drizzle ORM with Neon serverless Postgres, optimized for serverless and edge computing environments.

## Features

- ✅ Connection pooling with Neon serverless Postgres
- ✅ Prepared statements for SQL injection prevention
- ✅ Transaction support with automatic rollback
- ✅ Type-safe query builder
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Schema management (create/drop tables, migrations)
- ✅ Health checks for monitoring
- ✅ Optimized for serverless cold starts

## Installation

```bash
npm install @web-loom/api-adapter-drizzle
```

## Usage

### Basic Connection

```typescript
import { DrizzleAdapter } from '@web-loom/api-adapter-drizzle';

const adapter = new DrizzleAdapter();

await adapter.connect({
  url: process.env.DATABASE_URL,
  poolSize: 10,
  connectionTimeout: 10000,
});

// Check connection health
const isHealthy = await adapter.healthCheck();
console.log('Database healthy:', isHealthy);

// Clean up
await adapter.disconnect();
```

### Raw SQL Queries

```typescript
// Execute SELECT query
const users = await adapter.query<User>(
  'SELECT * FROM users WHERE age > $1 AND status = $2',
  [18, 'active']
);

// Execute INSERT/UPDATE/DELETE
await adapter.execute(
  'UPDATE users SET last_login = $1 WHERE id = $2',
  [new Date(), '123']
);
```

### Transactions

```typescript
const result = await adapter.transaction(async (tx) => {
  // Insert order
  await tx.execute(
    'INSERT INTO orders (user_id, total) VALUES ($1, $2)',
    [userId, 100]
  );
  
  // Update user balance
  await tx.execute(
    'UPDATE users SET balance = balance - $1 WHERE id = $2',
    [100, userId]
  );
  
  return { success: true };
});

// Automatically commits on success, rolls back on error
```

### Query Builder

```typescript
import type { ModelDefinition } from '@web-loom/api-adapter-drizzle';

const UserModel: ModelDefinition = {
  name: 'User',
  tableName: 'users',
  fields: [
    { name: 'id', type: 'uuid', database: { primaryKey: true } },
    { name: 'name', type: 'string', required: true },
    { name: 'email', type: 'string', required: true, unique: true },
    { name: 'status', type: 'string' },
  ],
};

// Build and execute query
const activeUsers = await adapter
  .select<User>(UserModel)
  .where({ status: 'active' })
  .orderBy('name', 'asc')
  .limit(20)
  .offset(0)
  .execute();
```

### CRUD Operations

```typescript
// Create
const newUser = await adapter.insert(UserModel, {
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active',
});

// Read (using query builder)
const users = await adapter
  .select<User>(UserModel)
  .where({ id: '123' })
  .execute();

// Update
const updatedUser = await adapter.update(UserModel, '123', {
  name: 'Jane Doe',
});

// Delete
await adapter.delete(UserModel, '123');
```

### Schema Management

```typescript
// Create table from model definition
await adapter.createTable(UserModel);

// Drop table
await adapter.dropTable(UserModel);

// Apply migration
await adapter.migrateSchema({
  name: '001_create_users_table',
  up: 'CREATE TABLE users (id UUID PRIMARY KEY, name TEXT, email TEXT UNIQUE)',
  down: 'DROP TABLE users',
});
```

## Model Definition

Define your data models with field types, constraints, and relationships:

```typescript
const PostModel: ModelDefinition = {
  name: 'Post',
  tableName: 'posts',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true },
    },
    {
      name: 'title',
      type: 'string',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      required: true,
    },
    {
      name: 'published',
      type: 'boolean',
      default: false,
    },
    {
      name: 'views',
      type: 'number',
      default: 0,
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  relationships: [
    {
      type: 'belongsTo',
      target: 'User',
      foreignKey: 'user_id',
    },
  ],
  options: {
    timestamps: true,
    softDelete: true,
  },
};
```

## Field Types

Supported field types and their database mappings:

| Field Type | Database Type | Description |
|------------|---------------|-------------|
| `string` | `TEXT` | Variable-length text |
| `number` | `INTEGER` | Integer numbers |
| `boolean` | `BOOLEAN` | True/false values |
| `date` | `TIMESTAMP` | Date and time |
| `uuid` | `UUID` | Universally unique identifier |
| `json` | `JSONB` | JSON data (binary format) |
| `decimal` | `DECIMAL` | Precise decimal numbers |

## Configuration

The adapter accepts a `DatabaseConfig` object:

```typescript
interface DatabaseConfig {
  url: string;              // Database connection URL
  poolSize?: number;        // Connection pool size (default: 10)
  connectionTimeout?: number; // Connection timeout in ms (default: 10000)
}
```

## Error Handling

The adapter throws errors for common failure scenarios:

```typescript
try {
  await adapter.connect(config);
} catch (error) {
  console.error('Failed to connect:', error.message);
}

try {
  const user = await adapter.update(UserModel, '999', { name: 'New Name' });
} catch (error) {
  // Throws: "Record with id 999 not found"
  console.error(error.message);
}
```

## Performance

- Connection pooling for efficient resource usage
- Prepared statements for query optimization
- Optimized for serverless cold starts (<100ms)
- Automatic connection caching with Neon

## Requirements

- Node.js 18+
- PostgreSQL database (Neon recommended for serverless)
- TypeScript 5.0+

## License

MIT
