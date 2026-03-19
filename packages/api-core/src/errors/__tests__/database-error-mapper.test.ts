import { describe, it, expect } from 'vitest';
import { mapDatabaseError, isDatabaseError } from '../database-error-mapper';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  InternalError,
  ErrorCode,
} from '@web-loom/api-shared';

describe('Database Error Mapper', () => {
  describe('mapDatabaseError', () => {
    it('should map unique constraint violation to ConflictError', () => {
      const dbError = new Error('duplicate key value violates unique constraint "users_email_key"');
      (dbError as any).code = '23505';

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(ConflictError);
      expect(mapped.message).toContain('Duplicate value');
      expect((mapped as ConflictError).code).toBe(ErrorCode.DUPLICATE_RESOURCE);
    });

    it('should extract constraint name from unique violation', () => {
      const dbError = new Error('duplicate key value violates unique constraint "users_email_key"');

      const mapped = mapDatabaseError(dbError);

      expect(mapped.message).toContain('users_email_key');
    });

    it('should map foreign key violation to ConflictError', () => {
      const dbError = new Error('violates foreign key constraint "posts_author_id_fkey"');
      (dbError as any).code = '23503';

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(ConflictError);
      expect(mapped.message).toContain('Foreign key constraint');
      expect((mapped as ConflictError).code).toBe(ErrorCode.CONFLICT);
    });

    it('should map not null violation to DatabaseError', () => {
      const dbError = new Error('null value in column "name" violates not-null constraint');
      (dbError as any).code = '23502';

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(DatabaseError);
      expect(mapped.message).toContain('Required field');
    });

    it('should map check constraint violation to DatabaseError', () => {
      const dbError = new Error('new row violates check constraint "age_positive"');
      (dbError as any).code = '23514';

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(DatabaseError);
      expect(mapped.message).toContain('Check constraint');
    });

    it('should map connection errors to InternalError with SERVICE_UNAVAILABLE', () => {
      const dbError = new Error('connection refused');
      (dbError as any).code = 'ECONNREFUSED';

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(InternalError);
      expect(mapped.message).toContain('Database connection failed');
      expect((mapped as InternalError).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    });

    it('should map "not found" messages to NotFoundError', () => {
      const dbError = new Error('Record with id 123 not found');

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(NotFoundError);
      expect(mapped.message).toContain('not found');
    });

    it('should handle non-Error objects', () => {
      const mapped = mapDatabaseError('string error');

      expect(mapped).toBeInstanceOf(DatabaseError);
      expect(mapped.message).toContain('Unknown database error');
    });

    it('should wrap unknown database errors as DatabaseError', () => {
      const dbError = new Error('Some unknown database error');

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(DatabaseError);
      expect(mapped.message).toContain('database error occurred');
    });

    it('should handle PostgreSQL unique violation without error code', () => {
      const dbError = new Error('ERROR: duplicate key value violates unique constraint');

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(ConflictError);
    });

    it('should handle connection timeout errors', () => {
      const dbError = new Error('connection timeout');
      (dbError as any).code = 'ETIMEDOUT';

      const mapped = mapDatabaseError(dbError);

      expect(mapped).toBeInstanceOf(InternalError);
      expect((mapped as InternalError).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    });

    it('should extract table name from error message', () => {
      const dbError = new Error('duplicate key value in table "users" violates unique constraint');

      const mapped = mapDatabaseError(dbError);

      expect(mapped.message).toContain('users');
    });
  });

  describe('isDatabaseError', () => {
    it('should return true for DatabaseError instances', () => {
      const error = new DatabaseError('Database error');
      expect(isDatabaseError(error)).toBe(true);
    });

    it('should return true for errors with database error codes', () => {
      const error = new Error('Some error');
      (error as any).code = '23505';
      expect(isDatabaseError(error)).toBe(true);
    });

    it('should return true for errors with database keywords', () => {
      const testCases = [
        'database connection failed',
        'SQL syntax error',
        'query execution failed',
        'constraint violation',
        'table not found',
        'column does not exist',
      ];

      testCases.forEach((message) => {
        const error = new Error(message);
        expect(isDatabaseError(error)).toBe(true);
      });
    });

    it('should return false for non-database errors', () => {
      const error = new Error('Generic error');
      expect(isDatabaseError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isDatabaseError('string')).toBe(false);
      expect(isDatabaseError(null)).toBe(false);
      expect(isDatabaseError(undefined)).toBe(false);
      expect(isDatabaseError(123)).toBe(false);
    });
  });
});
