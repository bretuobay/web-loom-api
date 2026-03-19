import { describe, it, expect, vi } from 'vitest';
import {
  createErrorHandler,
  formatErrorResponse,
  generateRequestId,
  extractErrorContext,
  getStatusCode,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  InternalError,
  ErrorCode,
  type ErrorContext,
} from '../error-handler';

const makeRequest = (path = '/api/users', method = 'GET') =>
  new Request(`http://localhost${path}`, { method });

describe('Error Handler', () => {
  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('extractErrorContext', () => {
    it('should extract path and method from request', () => {
      const request = makeRequest('/api/users', 'POST');
      const context = extractErrorContext(request);

      expect(context.path).toBe('/api/users');
      expect(context.method).toBe('POST');
      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should use provided request ID when given', () => {
      const request = makeRequest('/api/users');
      const context = extractErrorContext(request, 'req_123');

      expect(context.requestId).toBe('req_123');
    });

    it('should generate request ID when not provided', () => {
      const context = extractErrorContext(makeRequest());
      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('getStatusCode', () => {
    it('should return status code from WebLoomError', () => {
      const error = new NotFoundError('Not found');
      expect(getStatusCode(error)).toBe(404);
    });

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(getStatusCode(error)).toBe(500);
    });
  });

  describe('formatErrorResponse', () => {
    const context: ErrorContext = {
      requestId: 'req_123',
      path: '/api/users',
      method: 'GET',
    };

    it('should format WebLoomError', () => {
      const error = new NotFoundError('User not found', 'User');
      const response = formatErrorResponse(error, context, {
        environment: 'production',
      });

      expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(response.error.message).toBe('User not found');
      expect(response.error.requestId).toBe('req_123');
      expect(response.error.path).toBe('/api/users');
      expect(response.error.timestamp).toBeDefined();
      expect(response.error.stack).toBeUndefined();
    });

    it('should include stack trace in development', () => {
      const error = new Error('Test error');
      const response = formatErrorResponse(error, context, {
        environment: 'development',
      });

      expect(response.error.stack).toBeDefined();
    });

    it('should sanitize error message in production', () => {
      const error = new Error('Internal database connection failed');
      const response = formatErrorResponse(error, context, {
        environment: 'production',
      });

      expect(response.error.message).toBe('An unexpected error occurred');
    });

    it('should include error details for WebLoomError', () => {
      const error = new ValidationError('Validation failed', [
        {
          path: ['email'],
          message: 'Invalid email format',
          code: 'invalid_format',
        },
      ]);

      const response = formatErrorResponse(error, context, {
        environment: 'production',
      });

      expect(response.error.details).toEqual({
        fields: [
          {
            path: ['email'],
            message: 'Invalid email format',
            code: 'invalid_format',
          },
        ],
      });
    });
  });

  describe('createErrorHandler', () => {
    it('should catch and format WebLoomError', async () => {
      const error = new NotFoundError('User not found');
      const handler = createErrorHandler({ environment: 'production' });
      const response = await handler(error, makeRequest());

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Request-ID')).toBeDefined();

      const body = (await response.json()) as any;
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(body.error.message).toBe('User not found');
    });

    it('should catch and format generic errors', async () => {
      const error = new Error('Something went wrong');
      const handler = createErrorHandler({ environment: 'production' });
      const response = await handler(error, makeRequest());

      expect(response.status).toBe(500);

      const body = (await response.json()) as any;
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should include X-Request-ID header in response', async () => {
      const error = new Error('Test error');
      const handler = createErrorHandler();
      const response = await handler(error, makeRequest());

      expect(response.headers.get('X-Request-ID')).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should call custom logger', async () => {
      const error = new NotFoundError('Not found');
      const logger = vi.fn();
      const handler = createErrorHandler({ logger });

      await handler(error, makeRequest('/api/users'));

      expect(logger).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          requestId: expect.any(String),
          path: '/api/users',
          method: 'GET',
        })
      );
    });

    it('should handle different error types with correct status codes', async () => {
      const testCases = [
        { error: new ValidationError('Invalid', []), expectedStatus: 400 },
        { error: new AuthenticationError('Unauthorized'), expectedStatus: 401 },
        { error: new NotFoundError('Not found'), expectedStatus: 404 },
        { error: new ConflictError('Conflict'), expectedStatus: 409 },
        { error: new InternalError('Internal'), expectedStatus: 500 },
      ];

      for (const { error, expectedStatus } of testCases) {
        const handler = createErrorHandler();
        const response = await handler(error, makeRequest());
        expect(response.status).toBe(expectedStatus);
      }
    });
  });
});
