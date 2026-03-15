import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBodyValidation,
  createQueryValidation,
  createParamsValidation,
  createValidation,
} from '../validation-middleware';
import type { RequestContext, ValidationAdapter, Schema, ValidationResult } from '@web-loom/api-core';

// Mock validation adapter
class MockValidationAdapter implements ValidationAdapter {
  validateFn = vi.fn();

  defineSchema<T>(_definition: unknown): Schema<T> {
    return { _type: undefined } as Schema<T>;
  }

  validate<T>(_schema: Schema<T>, data: unknown): ValidationResult<T> {
    return this.validateFn(data);
  }

  async validateAsync<T>(_schema: Schema<T>, data: unknown): Promise<ValidationResult<T>> {
    return this.validateFn(data);
  }

  merge<T, U>(schema1: Schema<T>, _schema2: Schema<unknown>): Schema<T & U> {
    return schema1 as Schema<T & U>;
  }

  partial<T>(schema: Schema<T>): Schema<Partial<T>> {
    return schema as Schema<Partial<T>>;
  }

  pick<T, K extends keyof T>(schema: Schema<T>, _keys: K[]): Schema<Pick<T, K>> {
    return schema as Schema<Pick<T, K>>;
  }
}

describe('Validation Middleware', () => {
  let adapter: MockValidationAdapter;
  let schema: Schema<unknown>;
  let ctx: RequestContext;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new MockValidationAdapter();
    schema = adapter.defineSchema({});
    ctx = {
      request: new Request('http://localhost/test'),
      params: {},
      query: {},
      body: {},
      metadata: new Map(),
    };
    next = vi.fn(() => Promise.resolve(new Response('OK')));
  });

  describe('createBodyValidation', () => {
    it('should pass validation and call next', async () => {
      ctx.body = { name: 'John', email: 'john@example.com' };
      
      adapter.validateFn.mockReturnValue({
        success: true,
        data: { name: 'John', email: 'john@example.com' },
      });

      const middleware = createBodyValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(adapter.validateFn).toHaveBeenCalledWith({ name: 'John', email: 'john@example.com' });
      expect(ctx.body).toEqual({ name: 'John', email: 'john@example.com' });
      expect(next).toHaveBeenCalled();
      expect(response).toBeDefined();
    });

    it('should return 400 on validation failure', async () => {
      adapter.validateFn.mockReturnValue({
        success: false,
        errors: [
          {
            path: ['email'],
            message: 'Invalid email format',
            code: 'invalid_format',
          },
        ],
      });

      const middleware = createBodyValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(response.status).toBe(400);
      expect(next).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body.error).toBe('Validation Error');
      expect(body.details).toHaveLength(1);
      expect(body.details[0].field).toBe('email');
      expect(body.details[0].message).toBe('Invalid email format');
    });

    it('should handle multiple validation errors', async () => {
      adapter.validateFn.mockReturnValue({
        success: false,
        errors: [
          {
            path: ['name'],
            message: 'Name is required',
            code: 'required',
          },
          {
            path: ['email'],
            message: 'Invalid email format',
            code: 'invalid_format',
          },
        ],
      });

      const middleware = createBodyValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.details).toHaveLength(2);
    });

    it('should handle nested field errors', async () => {
      adapter.validateFn.mockReturnValue({
        success: false,
        errors: [
          {
            path: ['user', 'address', 'zip'],
            message: 'Invalid ZIP code',
            code: 'invalid_format',
          },
        ],
      });

      const middleware = createBodyValidation(adapter, schema);
      const response = await middleware(ctx, next);

      const body = await response.json();
      expect(body.details[0].field).toBe('user.address.zip');
    });
  });

  describe('createQueryValidation', () => {
    it('should pass validation and call next', async () => {
      adapter.validateFn.mockReturnValue({
        success: true,
        data: { page: '1', limit: '20' },
      });

      ctx.query = { page: '1', limit: '20' };
      const middleware = createQueryValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(adapter.validateFn).toHaveBeenCalledWith(ctx.query);
      expect(next).toHaveBeenCalled();
      expect(response).toBeDefined();
    });

    it('should return 400 on validation failure', async () => {
      adapter.validateFn.mockReturnValue({
        success: false,
        errors: [
          {
            path: ['page'],
            message: 'Page must be a positive number',
            code: 'invalid_type',
          },
        ],
      });

      const middleware = createQueryValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe('Query parameter validation failed');
      expect(body.details[0].field).toBe('page');
    });
  });

  describe('createParamsValidation', () => {
    it('should pass validation and call next', async () => {
      adapter.validateFn.mockReturnValue({
        success: true,
        data: { id: '123' },
      });

      ctx.params = { id: '123' };
      const middleware = createParamsValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(adapter.validateFn).toHaveBeenCalledWith(ctx.params);
      expect(next).toHaveBeenCalled();
      expect(response).toBeDefined();
    });

    it('should return 400 on validation failure', async () => {
      adapter.validateFn.mockReturnValue({
        success: false,
        errors: [
          {
            path: ['id'],
            message: 'ID must be a valid UUID',
            code: 'invalid_format',
          },
        ],
      });

      const middleware = createParamsValidation(adapter, schema);
      const response = await middleware(ctx, next);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe('Path parameter validation failed');
      expect(body.details[0].field).toBe('id');
    });
  });

  describe('createValidation', () => {
    it('should validate all parts when all schemas provided', async () => {
      adapter.validateFn
        .mockReturnValueOnce({ success: true, data: { name: 'John' } }) // body
        .mockReturnValueOnce({ success: true, data: { page: '1' } }) // query
        .mockReturnValueOnce({ success: true, data: { id: '123' } }); // params

      ctx.body = { name: 'John' };
      ctx.query = { page: '1' };
      ctx.params = { id: '123' };

      const middleware = createValidation(adapter, {
        body: schema,
        query: schema,
        params: schema,
      });

      const response = await middleware(ctx, next);

      expect(adapter.validateFn).toHaveBeenCalledTimes(3);
      expect(next).toHaveBeenCalled();
      expect(response).toBeDefined();
    });

    it('should validate only body when only body schema provided', async () => {
      adapter.validateFn.mockReturnValue({
        success: true,
        data: { name: 'John' },
      });

      const middleware = createValidation(adapter, {
        body: schema,
      });

      await middleware(ctx, next);

      expect(adapter.validateFn).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalled();
    });

    it('should collect errors from all parts', async () => {
      adapter.validateFn
        .mockReturnValueOnce({
          success: false,
          errors: [{ path: ['name'], message: 'Name required', code: 'required' }],
        }) // body
        .mockReturnValueOnce({
          success: false,
          errors: [{ path: ['page'], message: 'Invalid page', code: 'invalid_type' }],
        }) // query
        .mockReturnValueOnce({
          success: false,
          errors: [{ path: ['id'], message: 'Invalid ID', code: 'invalid_format' }],
        }); // params

      const middleware = createValidation(adapter, {
        body: schema,
        query: schema,
        params: schema,
      });

      const response = await middleware(ctx, next);

      expect(response.status).toBe(400);
      expect(next).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body.details).toHaveLength(3);
      expect(body.details[0].field).toBe('body.name');
      expect(body.details[1].field).toBe('query.page');
      expect(body.details[2].field).toBe('params.id');
    });

    it('should continue if some validations pass and some fail', async () => {
      adapter.validateFn
        .mockReturnValueOnce({ success: true, data: { name: 'John' } }) // body passes
        .mockReturnValueOnce({
          success: false,
          errors: [{ path: ['page'], message: 'Invalid page', code: 'invalid_type' }],
        }); // query fails

      const middleware = createValidation(adapter, {
        body: schema,
        query: schema,
      });

      const response = await middleware(ctx, next);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.details).toHaveLength(1);
      expect(body.details[0].field).toBe('query.page');
    });

    it('should call next when validation fails but no errors collected', async () => {
      // This edge case: validation returns success=false but errors is empty
      // In this case, we have no specific errors to report, so we proceed
      adapter.validateFn.mockReturnValue({
        success: false,
        errors: [],
      });

      const middleware = createValidation(adapter, {
        body: schema,
      });

      const response = await middleware(ctx, next);

      // No errors collected, so next() is called
      expect(next).toHaveBeenCalled();
      expect(response).toBeDefined();
    });
  });
});
