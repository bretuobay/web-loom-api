# @webloom/api-shared

Shared types and utilities for Web Loom API Framework.

## Installation

```bash
npm install @webloom/api-shared
```

## Features

- **HTTP Types**: Type-safe HTTP methods and status codes
- **Utility Types**: Advanced TypeScript utility types for type manipulation
- **Error Types**: Comprehensive error classes and error code enums
- **Type Safety**: Full TypeScript support with detailed JSDoc comments

## Usage

### HTTP Types

```typescript
import { HTTPMethod, HTTPStatus, HTTPStatusCode } from '@webloom/api-shared';

// HTTP methods
const method: HTTPMethod = 'GET';

// HTTP status codes (type-safe)
const status: HTTPStatusCode = 200;

// HTTP status constants
if (response.status === HTTPStatus.OK) {
  // Handle success
}
```

### Utility Types

```typescript
import { 
  Prettify, 
  DeepPartial, 
  DeepReadonly,
  RequireAtLeastOne,
  RequireKeys,
  OptionalKeys,
  Nullable,
  Maybe
} from '@webloom/api-shared';

// Prettify - Flatten intersection types for better IDE tooltips
type User = Prettify<{ id: string } & { name: string }>;

// DeepPartial - Make all properties optional recursively
type PartialUser = DeepPartial<User>;

// DeepReadonly - Make all properties readonly recursively
type ReadonlyUser = DeepReadonly<User>;

// RequireAtLeastOne - Require at least one of the specified keys
type UpdateUser = RequireAtLeastOne<User, 'name' | 'email'>;

// RequireKeys - Make specific keys required
type UserWithId = RequireKeys<Partial<User>, 'id'>;

// OptionalKeys - Make specific keys optional
type OptionalEmail = OptionalKeys<User, 'email'>;

// Nullable - Make a type nullable
type NullableUser = Nullable<User>;

// Maybe - Make a type nullable or undefined
type MaybeUser = Maybe<User>;
```

### Error Types

```typescript
import {
  ErrorCode,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ConfigurationError,
  type ErrorResponse,
  type ValidationErrorField
} from '@webloom/api-shared';

// Validation errors with field-level details
const validationError = new ValidationError('Validation failed', [
  {
    path: ['user', 'email'],
    message: 'Invalid email format',
    code: 'invalid_format',
    value: 'not-an-email'
  }
]);

// Authentication errors
const authError = new AuthenticationError('Invalid token');

// Not found errors with resource context
const notFoundError = new NotFoundError('User not found', 'User');

// Conflict errors
const conflictError = new ConflictError('Email already exists');

// Rate limit errors with retry information
const rateLimitError = new RateLimitError('Too many requests', 60);

// Database errors with original error context
const dbError = new DatabaseError('Query failed', originalError);

// Configuration errors
const configError = new ConfigurationError('Invalid config');

// Error response format
const errorResponse: ErrorResponse = {
  error: {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Validation failed',
    details: { fields: [] },
    timestamp: new Date().toISOString(),
    requestId: 'req-123',
    path: '/api/users'
  }
};
```

### Error Codes

All error codes are available as an enum:

```typescript
import { ErrorCode } from '@webloom/api-shared';

// Validation errors
ErrorCode.VALIDATION_ERROR
ErrorCode.INVALID_INPUT
ErrorCode.MISSING_FIELD
ErrorCode.INVALID_FORMAT

// Authentication errors
ErrorCode.UNAUTHORIZED
ErrorCode.INVALID_TOKEN
ErrorCode.TOKEN_EXPIRED
ErrorCode.INVALID_CREDENTIALS

// Authorization errors
ErrorCode.FORBIDDEN
ErrorCode.INSUFFICIENT_PERMISSIONS

// Resource errors
ErrorCode.NOT_FOUND
ErrorCode.RESOURCE_NOT_FOUND
ErrorCode.CONFLICT
ErrorCode.DUPLICATE_RESOURCE

// Rate limiting
ErrorCode.RATE_LIMIT_EXCEEDED

// Server errors
ErrorCode.INTERNAL_ERROR
ErrorCode.DATABASE_ERROR
ErrorCode.EXTERNAL_SERVICE_ERROR
ErrorCode.SERVICE_UNAVAILABLE

// Configuration errors
ErrorCode.CONFIGURATION_ERROR
ErrorCode.ADAPTER_ERROR
ErrorCode.INITIALIZATION_ERROR
```

### Utility Functions

```typescript
import { isObject, isEmpty } from '@webloom/api-shared';

// Check if value is a plain object
if (isObject(value)) {
  // value is Record<string, unknown>
}

// Check if value is empty
if (isEmpty(value)) {
  // value is null, undefined, empty string, empty array, or empty object
}
```

## API Reference

### Types

- `HTTPMethod` - Union type of HTTP methods
- `HTTPStatusCode` - Union type of common HTTP status codes
- `HTTPStatus` - Constants object for HTTP status codes
- `Prettify<T>` - Flatten intersection types
- `DeepPartial<T>` - Make all properties optional recursively
- `DeepReadonly<T>` - Make all properties readonly recursively
- `RequireAtLeastOne<T, Keys>` - Require at least one of the specified keys
- `RequireKeys<T, K>` - Make specified keys required
- `OptionalKeys<T, K>` - Make specified keys optional
- `KeysOfType<T, U>` - Extract keys with values assignable to U
- `Nullable<T>` - Make a type nullable
- `Maybe<T>` - Make a type nullable or undefined
- `Awaited<T>` - Extract the awaited type from a Promise
- `DotPath<T>` - Create a union of all possible dot-notation paths

### Error Classes

- `WebLoomError` - Base error class
- `ValidationError` - Validation errors with field details
- `AuthenticationError` - Authentication failures
- `AuthorizationError` - Authorization failures
- `NotFoundError` - Resource not found errors
- `ConflictError` - Resource conflict errors
- `RateLimitError` - Rate limit exceeded errors
- `InternalError` - Internal server errors
- `DatabaseError` - Database operation errors
- `ConfigurationError` - Configuration errors

### Interfaces

- `ErrorResponse` - Standard error response format
- `ValidationErrorField` - Validation error field details
- `ValidationErrorDetails` - Validation error details structure

## License

MIT
