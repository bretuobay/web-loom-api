# @web-loom/api-adapter-zod

Zod adapter for Web Loom API Framework. Provides runtime type validation with TypeScript type inference using Zod.

## Features

- ✅ Runtime type validation with TypeScript inference
- ✅ String validation (minLength, maxLength, email, URL, UUID, patterns)
- ✅ Number validation (min, max, integer, positive)
- ✅ Boolean, date, array, and object validation
- ✅ Enum validation
- ✅ Custom validation functions
- ✅ Async validation support
- ✅ Schema operations (merge, partial, pick)
- ✅ Detailed error messages with field paths

## Installation

```bash
npm install @web-loom/api-adapter-zod
```

## Usage

### Basic Validation

```typescript
import { ZodAdapter } from '@web-loom/api-adapter-zod';

const adapter = new ZodAdapter();

const userSchema = adapter.defineSchema({
  name: { type: 'string', required: true, minLength: 2 },
  email: { type: 'string', required: true, format: 'email' },
  age: { type: 'number', required: true, min: 0, max: 120 },
});

const result = adapter.validate(userSchema, {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
});

if (result.success) {
  console.log('Valid data:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}
```

### Schema Operations

```typescript
// Merge schemas
const baseSchema = adapter.defineSchema({
  id: { type: 'string', required: true },
});

const userSchema = adapter.defineSchema({
  name: { type: 'string', required: true },
});

const fullSchema = adapter.merge(baseSchema, userSchema);

// Make all fields optional (for PATCH operations)
const updateSchema = adapter.partial(userSchema);

// Pick specific fields
const publicSchema = adapter.pick(fullSchema, ['id', 'name']);
```

### Async Validation

```typescript
const result = await adapter.validateAsync(schema, data);
```

## Field Types

| Type | Description | Constraints |
|------|-------------|-------------|
| `string` | Text values | minLength, maxLength, pattern, format (email, url, uuid) |
| `number` | Numeric values | min, max, integer, positive |
| `boolean` | True/false | - |
| `date` | Date objects | - |
| `array` | Arrays | items (item schema), minItems, maxItems |
| `object` | Nested objects | properties (nested schema) |

## License

MIT
