import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import type { RequestContext, NextFunction } from '../../interfaces';

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
    it('should extract context from request', () => {
      const ctx: RequestContext = {
        request: new Request('http://localhost/api/users'),
        params: {},
        query: {},
        body: null,
        metadata: new Map([
          ['requestId', 'req_123'],
          ['userId', 'user_456'],
        ]),
      };

      const context = extractErrorContext(ctx);

      expect(context.requestId).toBe('req_123');
      expect(context.path).toBe('/api/users');
      expect(context.method).toBe('GET');
      expect(context.userId).toBe('user_456');
    });

    it('should generate request ID if not present', () => {
      const ctx: RequestContext = {
        request: new Request('http://localhost/api/users'),
        params: {},
        query: {},
        body: null,
        metadata: new Map(),
      };

      const context = extractErrorContext(ctx);

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
    let mockNext: NextFunction;
    let ctx: RequestContext;

    beforeEach(() => {
      mockNext = vi.fn();
      ctx = {
        request: new Request('http://localhost/api/users'),
        params: {},
        query: {},
        body: null,
        metadata: new Map(),
      };
    });

    it('should pass through successful responses', async () => {
      const successResponse = new Response('OK', { status: 200 });
      mockNext = vi.fn().mockResolvedValue(successResponse);

      const handler = createErrorHandler();
      const response = await handler(ctx, mockNext);

      expect(response).toBe(successResponse);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should catch and format WebLoomError', async () => {
      const error = new NotFoundError('User not found');
      mockNext = vi.fn().mockRejectedValue(error);

      const handler = createErrorHandler({ environment: 'production' });
      const response = await handler(ctx, mockNext);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Request-ID')).toBeDefined();

      const body = await response.json() as any;
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(body.error.message).toBe('User not found');
    });

    it('should catch and format generic errors', async () => {
      const error = new Error('Something went wrong');
      mockNext = vi.fn().mockRejectedValue(error);

      const handler = createErrorHandler({ environment: 'production' });
      const response = await handler(ctx, mockNext);

      expect(response.status).toBe(500);

      const body = await response.json() as any;
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should add request ID if not present', async () => {
      const error = new Error('Test error');
      mockNext = vi.fn().mockRejectedValue(error);

      const handler = createErrorHandler();
      await handler(ctx, mockNext);

      expect(ctx.metadata.has('requestId')).toBe(true);
    });

    it('should call custom logger', async () => {
      const error = new NotFoundError('Not found');
      mockNext = vi.fn().mockRejectedValue(error);

      const logger = vi.fn();
      const handler = createErrorHandler({ logger });

      await handler(ctx, mockNext);

      expect(logger).toHaveBeenCalledWith(error, expect.objectContaining({
        requestId: expect.any(String),
        path: '/api/users',
        method: 'GET',
      }));
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
        mockNext = vi.fn().mockRejectedValue(error);
        const handler = createErrorHandler();
        const response = await handler(ctx, mockNext);

        expect(response.status).toBe(expectedStatus);
      }
    });
  });
});
