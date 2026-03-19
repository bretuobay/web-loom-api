/**
 * Database Error Mapper
 *
 * Maps database-specific errors to appropriate HTTP status codes and error types.
 * Handles common database errors like unique constraint violations, foreign key
 * violations, and connection errors.
 */

import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  InternalError,
  ErrorCode,
} from '@web-loom/api-shared';

/**
 * Database error patterns for different database systems
 */
const ERROR_PATTERNS = {
  // PostgreSQL error codes
  UNIQUE_VIOLATION: ['23505', 'unique constraint', 'duplicate key'],
  FOREIGN_KEY_VIOLATION: ['23503', 'foreign key constraint', 'violates foreign key'],
  NOT_NULL_VIOLATION: ['23502', 'null value', 'violates not-null'],
  CHECK_VIOLATION: ['23514', 'check constraint'],

  // Connection errors
  CONNECTION_ERROR: [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'connection refused',
    'connection timeout',
    'connection lost',
    'connection terminated',
  ],

  // Not found patterns
  NOT_FOUND: ['not found', 'does not exist', 'no rows', 'zero rows'],
};

/**
 * Check if error message matches any pattern
 */
function matchesPattern(message: string, patterns: string[]): boolean {
  const lowerMessage = message.toLowerCase();
  return patterns.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
}

/**
 * Extract constraint name from error message
 */
function extractConstraintName(message: string): string | undefined {
  // Try to extract constraint name from common patterns
  const patterns = [
    /constraint "([^"]+)"/i,
    /constraint '([^']+)'/i,
    /constraint `([^`]+)`/i,
    /key "([^"]+)"/i,
    /key '([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract table name from error message
 */
function extractTableName(message: string): string | undefined {
  const patterns = [
    /table "([^"]+)"/i,
    /table '([^']+)'/i,
    /table `([^`]+)`/i,
    /on table "([^"]+)"/i,
    /in table "([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Map database error to appropriate application error
 *
 * @param error - Original database error
 * @returns Mapped application error
 *
 * @example
 * ```typescript
 * try {
 *   await database.insert(model, data);
 * } catch (error) {
 *   throw mapDatabaseError(error);
 * }
 * ```
 */
export function mapDatabaseError(error: unknown): Error {
  // If not an error object, wrap it
  if (!(error instanceof Error)) {
    return new DatabaseError('Unknown database error occurred');
  }

  const message = error.message;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorCode = (error as any).code;

  // Check for unique constraint violation (409 Conflict)
  if (
    (errorCode && ERROR_PATTERNS.UNIQUE_VIOLATION.includes(errorCode)) ||
    matchesPattern(message, ERROR_PATTERNS.UNIQUE_VIOLATION)
  ) {
    const constraintName = extractConstraintName(message);
    const tableName = extractTableName(message);

    let conflictMessage = 'A record with this value already exists';
    if (constraintName) {
      conflictMessage = `Duplicate value violates constraint: ${constraintName}`;
    } else if (tableName) {
      conflictMessage = `A record in ${tableName} with this value already exists`;
    }

    return new ConflictError(conflictMessage, ErrorCode.DUPLICATE_RESOURCE);
  }

  // Check for foreign key violation (409 Conflict)
  if (
    (errorCode && ERROR_PATTERNS.FOREIGN_KEY_VIOLATION.includes(errorCode)) ||
    matchesPattern(message, ERROR_PATTERNS.FOREIGN_KEY_VIOLATION)
  ) {
    const constraintName = extractConstraintName(message);

    let conflictMessage = 'Referenced record does not exist or is still in use';
    if (constraintName) {
      conflictMessage = `Foreign key constraint violated: ${constraintName}`;
    }

    return new ConflictError(conflictMessage, ErrorCode.CONFLICT);
  }

  // Check for not null violation (400 Bad Request)
  if (
    (errorCode && ERROR_PATTERNS.NOT_NULL_VIOLATION.includes(errorCode)) ||
    matchesPattern(message, ERROR_PATTERNS.NOT_NULL_VIOLATION)
  ) {
    return new DatabaseError('Required field is missing', error);
  }

  // Check for check constraint violation (400 Bad Request)
  if (
    (errorCode && ERROR_PATTERNS.CHECK_VIOLATION.includes(errorCode)) ||
    matchesPattern(message, ERROR_PATTERNS.CHECK_VIOLATION)
  ) {
    const constraintName = extractConstraintName(message);

    let checkMessage = 'Data validation failed';
    if (constraintName) {
      checkMessage = `Check constraint violated: ${constraintName}`;
    }

    return new DatabaseError(checkMessage, error);
  }

  // Check for connection errors (503 Service Unavailable)
  if (
    (errorCode && ERROR_PATTERNS.CONNECTION_ERROR.includes(errorCode)) ||
    matchesPattern(message, ERROR_PATTERNS.CONNECTION_ERROR)
  ) {
    return new InternalError(
      'Database connection failed. Please try again later.',
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }

  // Check for not found errors (404 Not Found)
  if (matchesPattern(message, ERROR_PATTERNS.NOT_FOUND)) {
    return new NotFoundError('Record not found');
  }

  // Default: wrap as DatabaseError
  return new DatabaseError('A database error occurred', error);
}

/**
 * Check if error is a database error
 */
export function isDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Check if it's already a DatabaseError
  if (error instanceof DatabaseError) {
    return true;
  }

  // Check for common database error indicators
  const message = error.message.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorCode = (error as any).code;

  return (
    // Has database error code
    (errorCode && typeof errorCode === 'string' && /^[0-9A-Z]+$/.test(errorCode)) ||
    // Contains database-related keywords
    message.includes('database') ||
    message.includes('sql') ||
    message.includes('query') ||
    message.includes('constraint') ||
    message.includes('relation') ||
    message.includes('table') ||
    message.includes('column')
  );
}
