# @web-loom/api-middleware-validation

Validation middleware for Web Loom API Framework. Provides middleware for validating request body, query parameters, and path parameters using any ValidationAdapter (e.g., Zod).

## Features

- ✅ Body validation middleware
- ✅ Query parameter validation middleware
- ✅ Path parameter validation middleware
- ✅ Combined validation for all request parts
- ✅ Detailed error responses with field paths
- ✅ Type-safe with TypeScript
- ✅ Works with any ValidationAdapter

## Installation

```bash
npm install @web-loom/api-middleware-validation
```

## Usage

### Body Validation

```typescript
import { createBodyValidation } from '@web-loom/api-middleware-validation';
import { ZodAdapter } from '@web-loom/api-adapter-zod';

const adapter = new ZodAdapter();
const userSchema = adapter.defineSchema({
  name: { type: 'string', required: true, minLength: 2 },
  email: { type: 'string', required: true, format: 'email' },
  age: { type: 'number', required: true, min: 0 },
});

const validateBody = createBodyValidation(adapter, userSchema);

// Use in route handler
app.post('/users', validateBody, async (ctx) => {
  // ctx.body is now validated and typed
  const user = await createUser(ctx.body);
  return Response.json(user);
});
```

### Query Parameter Validation

```typescript
import { createQueryValidation } from '@web-loom/api-middleware-validation';

const querySchema = adapter.defineSchema({
  page: { type: 'number', required: false, min: 1 },
  limit: { type: 'number', required: false, min: 1, max: 100 },
  sort: { type: 'string', required: false },
});

const validateQuery = createQueryValidation(adapter, querySchema);

app.get('/users', validateQuery, async (ctx) => {
  // ctx.query is validated
  const users = await getUsers(ctx.query);
  return Response.json(users);
});
```

### Path Parameter Validation

```typescript
import { createParamsValidation } from '@web-loom/api-middleware-validation';

const paramsSchema = adapter.defineSchema({
  id: { type: 'string', required: true, format: 'uuid' },
});

const validateParams = createParamsValidation(adapter, paramsSchema);

app.get('/users/:id', validateParams, async (ctx) => {
  // ctx.params.id is validated as UUID
  const user = await getUser(ctx.params.id);
  return Response.json(user);
});
```

### Combined Validation

```typescript
import { createValidation } from '@web-loom/api-middleware-validation';

const validate = createValidation(adapter, {
  params: paramsSchema,
  query: querySchema,
  body: bodySchema,
});

app.patch('/users/:id', validate, async (ctx) => {
  // All parts validated
  const user = await updateUser(ctx.params.id, ctx.body, ctx.query);
  return Response.json(user);
});
```

## Error Response Format

When validation fails, the middleware returns a 400 response with detailed error information:

```json
{
  "error": "Validation Error",
  "message": "Request body validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_format"
    },
    {
      "field": "age",
      "message": "Must be at least 0",
      "code": "too_small"
    }
  ]
}
```

## API

### `createBodyValidation(adapter, schema)`

Creates middleware for validating request body.

- **adapter**: ValidationAdapter instance
- **schema**: Schema to validate against
- **Returns**: Middleware function

### `createQueryValidation(adapter, schema)`

Creates middleware for validating query parameters.

- **adapter**: ValidationAdapter instance
- **schema**: Schema to validate against
- **Returns**: Middleware function

### `createParamsValidation(adapter, schema)`

Creates middleware for validating path parameters.

- **adapter**: ValidationAdapter instance
- **schema**: Schema to validate against
- **Returns**: Middleware function

### `createValidation(adapter, schemas)`

Creates combined validation middleware for body, query, and params.

- **adapter**: ValidationAdapter instance
- **schemas**: Object with optional `body`, `query`, and `params` schemas
- **Returns**: Middleware function

## License

MIT
