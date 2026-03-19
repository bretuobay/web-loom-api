import { describe, it, expect } from 'vitest';
import {
  HTTPMethod,
  HTTPStatus,
  HTTPStatusCode,
  ErrorCode,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ConfigurationError,
  type ErrorResponse,
  type ValidationErrorField,
  type Prettify,
  type DeepPartial,
  type DeepReadonly,
} from './index';

describe('api-shared', () => {
  describe('HTTP types', () => {
    it('should have correct HTTP methods', () => {
      const methods: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      expect(methods).toHaveLength(7);
    });

    it('should have HTTP status constants', () => {
      expect(HTTPStatus.OK).toBe(200);
      expect(HTTPStatus.CREATED).toBe(201);
      expect(HTTPStatus.BAD_REQUEST).toBe(400);
      expect(HTTPStatus.UNAUTHORIZED).toBe(401);
      expect(HTTPStatus.NOT_FOUND).toBe(404);
      expect(HTTPStatus.INTERNAL_SERVER_ERROR).toBe(500);
    });

    it('should accept valid HTTP status codes', () => {
      const status: HTTPStatusCode = 200;
      expect(status).toBe(200);
    });
  });

  describe('Error types', () => {
    it('should create ValidationError with fields', () => {
      const fields: ValidationErrorField[] = [
        {
          path: ['user', 'email'],
          message: 'Invalid email format',
          code: 'invalid_format',
          value: 'not-an-email',
        },
      ];

      const error = new ValidationError('Validation failed', fields);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(HTTPStatus.BAD_REQUEST);
      expect(error.fields).toEqual(fields);
    });

    it('should create AuthenticationError', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.statusCode).toBe(HTTPStatus.UNAUTHORIZED);
    });

    it('should create NotFoundError with resource', () => {
      const error = new NotFoundError('User not found', 'User');
      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(HTTPStatus.NOT_FOUND);
      expect(error.resource).toBe('User');
    });

    it('should create ConflictError', () => {
      const error = new ConflictError('Email already exists');
      expect(error.name).toBe('ConflictError');
      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.statusCode).toBe(HTTPStatus.CONFLICT);
    });

    it('should create RateLimitError with retryAfter', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(HTTPStatus.TOO_MANY_REQUESTS);
      expect(error.retryAfter).toBe(60);
    });

    it('should create DatabaseError with original error', () => {
      const originalError = new Error('Connection timeout');
      const error = new DatabaseError('Database operation failed', originalError);
      expect(error.name).toBe('DatabaseError');
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.statusCode).toBe(HTTPStatus.INTERNAL_SERVER_ERROR);
      expect(error.originalError).toBe(originalError);
    });

    it('should create ConfigurationError', () => {
      const error = new ConfigurationError('Invalid configuration');
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
      expect(error.statusCode).toBe(HTTPStatus.INTERNAL_SERVER_ERROR);
    });

    it('should have all error codes defined', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.CONFLICT).toBe('CONFLICT');
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
    });
  });

  describe('Utility types', () => {
    it('should work with Prettify type', () => {
      type Original = { a: string } & { b: number };
      type Pretty = Prettify<Original>;

      const obj: Pretty = { a: 'test', b: 123 };
      expect(obj.a).toBe('test');
      expect(obj.b).toBe(123);
    });

    it('should work with DeepPartial type', () => {
      interface User {
        name: string;
        profile: {
          age: number;
          address: {
            city: string;
          };
        };
      }

      const partialUser: DeepPartial<User> = {
        profile: {
          address: {
            city: 'New York',
          },
        },
      };

      expect(partialUser.profile?.address?.city).toBe('New York');
    });

    it('should work with DeepReadonly type', () => {
      interface Config {
        database: {
          host: string;
          port: number;
        };
      }

      const config: DeepReadonly<Config> = {
        database: {
          host: 'localhost',
          port: 5432,
        },
      };

      expect(config.database.host).toBe('localhost');
      expect(config.database.port).toBe(5432);
    });
  });

  describe('ErrorResponse interface', () => {
    it('should match expected structure', () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { fields: [] },
          timestamp: new Date().toISOString(),
          requestId: 'req-123',
          path: '/api/users',
        },
      };

      expect(errorResponse.error.code).toBe('VALIDATION_ERROR');
      expect(errorResponse.error.message).toBe('Validation failed');
      expect(errorResponse.error.requestId).toBe('req-123');
    });
  });
});
