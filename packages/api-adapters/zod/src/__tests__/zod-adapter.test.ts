import { describe, it, expect, beforeEach } from 'vitest';
import { ZodAdapter } from '../zod-adapter';

describe('ZodAdapter', () => {
  let adapter: ZodAdapter;

  beforeEach(() => {
    adapter = new ZodAdapter();
  });

  describe('Schema Definition', () => {
    it('should define a simple string schema', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true },
      });

      expect(schema).toBeDefined();
    });

    it('should define a schema with multiple field types', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true },
        age: { type: 'number', required: true },
        active: { type: 'boolean', required: true },
        createdAt: { type: 'date', required: true },
      });

      expect(schema).toBeDefined();
    });

    it('should define a schema with optional fields', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true },
        nickname: { type: 'string', required: false },
      });

      const result = adapter.validate(schema, { name: 'John' });
      expect(result.success).toBe(true);
    });
  });

  describe('String Validation', () => {
    it('should validate string with minLength constraint', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true, minLength: 3 },
      });

      const validResult = adapter.validate(schema, { name: 'John' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { name: 'Jo' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('at least 3');
    });

    it('should validate string with maxLength constraint', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true, maxLength: 10 },
      });

      const validResult = adapter.validate(schema, { name: 'John' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { name: 'VeryLongName' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('at most 10');
    });

    it('should validate email format', () => {
      const schema = adapter.defineSchema({
        email: { type: 'string', required: true, format: 'email' },
      });

      const validResult = adapter.validate(schema, { email: 'user@example.com' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { email: 'invalid-email' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('email');
    });

    it('should validate URL format', () => {
      const schema = adapter.defineSchema({
        website: { type: 'string', required: true, format: 'url' },
      });

      const validResult = adapter.validate(schema, { website: 'https://example.com' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { website: 'not-a-url' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('URL');
    });

    it('should validate UUID format', () => {
      const schema = adapter.defineSchema({
        id: { type: 'string', required: true, format: 'uuid' },
      });

      const validResult = adapter.validate(schema, {
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { id: 'not-a-uuid' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('UUID');
    });

    it('should validate pattern constraint', () => {
      const schema = adapter.defineSchema({
        code: { type: 'string', required: true, pattern: '^[A-Z]{3}$' },
      });

      const validResult = adapter.validate(schema, { code: 'ABC' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { code: 'abc' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('pattern');
    });
  });

  describe('Number Validation', () => {
    it('should validate number with min constraint', () => {
      const schema = adapter.defineSchema({
        age: { type: 'number', required: true, min: 0 },
      });

      const validResult = adapter.validate(schema, { age: 25 });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { age: -5 });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('at least 0');
    });

    it('should validate number with max constraint', () => {
      const schema = adapter.defineSchema({
        age: { type: 'number', required: true, max: 120 },
      });

      const validResult = adapter.validate(schema, { age: 25 });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { age: 150 });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('at most 120');
    });

    it('should validate integer constraint', () => {
      const schema = adapter.defineSchema({
        count: { type: 'number', required: true, integer: true },
      });

      const validResult = adapter.validate(schema, { count: 10 });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { count: 10.5 });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('integer');
    });

    it('should validate positive constraint', () => {
      const schema = adapter.defineSchema({
        price: { type: 'number', required: true, positive: true },
      });

      const validResult = adapter.validate(schema, { price: 99.99 });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { price: -10 });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('positive');
    });
  });

  describe('Boolean Validation', () => {
    it('should validate boolean values', () => {
      const schema = adapter.defineSchema({
        active: { type: 'boolean', required: true },
      });

      const validResult1 = adapter.validate(schema, { active: true });
      expect(validResult1.success).toBe(true);

      const validResult2 = adapter.validate(schema, { active: false });
      expect(validResult2.success).toBe(true);

      const invalidResult = adapter.validate(schema, { active: 'yes' });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Date Validation', () => {
    it('should validate date values', () => {
      const schema = adapter.defineSchema({
        createdAt: { type: 'date', required: true },
      });

      const validResult = adapter.validate(schema, { createdAt: new Date() });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { createdAt: 'not-a-date' });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Array Validation', () => {
    it('should validate array with item schema', () => {
      const schema = adapter.defineSchema({
        tags: {
          type: 'array',
          required: true,
          items: { type: 'string', required: true },
        },
      });

      const validResult = adapter.validate(schema, { tags: ['tag1', 'tag2'] });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { tags: ['tag1', 123] });
      expect(invalidResult.success).toBe(false);
    });

    it('should validate array with minItems constraint', () => {
      const schema = adapter.defineSchema({
        tags: {
          type: 'array',
          required: true,
          items: { type: 'string', required: true },
          minItems: 2,
        },
      });

      const validResult = adapter.validate(schema, { tags: ['tag1', 'tag2'] });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { tags: ['tag1'] });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('at least 2');
    });

    it('should validate array with maxItems constraint', () => {
      const schema = adapter.defineSchema({
        tags: {
          type: 'array',
          required: true,
          items: { type: 'string', required: true },
          maxItems: 3,
        },
      });

      const validResult = adapter.validate(schema, { tags: ['tag1', 'tag2'] });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, {
        tags: ['tag1', 'tag2', 'tag3', 'tag4'],
      });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors?.[0].message).toContain('at most 3');
    });
  });

  describe('Object Validation', () => {
    it('should validate nested object', () => {
      const schema = adapter.defineSchema({
        user: {
          type: 'object',
          required: true,
          properties: {
            name: { type: 'string', required: true },
            email: { type: 'string', required: true, format: 'email' },
          },
        },
      });

      const validResult = adapter.validate(schema, {
        user: { name: 'John', email: 'john@example.com' },
      });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, {
        user: { name: 'John', email: 'invalid-email' },
      });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    it('should validate enum values', () => {
      const schema = adapter.defineSchema({
        status: { type: 'string', required: true, enum: ['active', 'inactive', 'pending'] },
      });

      const validResult = adapter.validate(schema, { status: 'active' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { status: 'unknown' });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should apply default values', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true },
        status: { type: 'string', required: false, default: 'active' },
      });

      const result = adapter.validate(schema, { name: 'John' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', status: 'active' });
    });
  });

  describe('Custom Validation', () => {
    it('should support custom validation functions', () => {
      const schema = adapter.defineSchema({
        password: {
          type: 'string',
          required: true,
          validate: (value) => {
            const str = String(value);
            return str.length >= 8 && /[A-Z]/.test(str) && /[0-9]/.test(str);
          },
        },
      });

      const validResult = adapter.validate(schema, { password: 'Password123' });
      expect(validResult.success).toBe(true);

      const invalidResult = adapter.validate(schema, { password: 'weak' });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Async Validation', () => {
    it('should support async validation', async () => {
      const schema = adapter.defineSchema({
        email: { type: 'string', required: true, format: 'email' },
      });

      const result = await adapter.validateAsync(schema, {
        email: 'user@example.com',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Operations', () => {
    it('should merge two schemas', () => {
      const schema1 = adapter.defineSchema({
        id: { type: 'string', required: true },
      });

      const schema2 = adapter.defineSchema({
        name: { type: 'string', required: true },
      });

      const merged = adapter.merge(schema1, schema2);
      const result = adapter.validate(merged, { id: '123', name: 'John' });
      expect(result.success).toBe(true);
    });

    it('should create partial schema', () => {
      const schema = adapter.defineSchema({
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
      });

      const partial = adapter.partial(schema);
      const result = adapter.validate(partial, { name: 'John' });
      expect(result.success).toBe(true);
    });

    it('should pick specific fields', () => {
      const schema = adapter.defineSchema({
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        password: { type: 'string', required: true },
      });

      const picked = adapter.pick(schema, ['id', 'name', 'email']);
      const result = adapter.validate(picked, {
        id: '123',
        name: 'John',
        email: 'john@example.com',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Error Formatting', () => {
    it('should format validation errors with field paths', () => {
      const schema = adapter.defineSchema({
        user: {
          type: 'object',
          required: true,
          properties: {
            email: { type: 'string', required: true, format: 'email' },
          },
        },
      });

      const result = adapter.validate(schema, {
        user: { email: 'invalid-email' },
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].path).toEqual(['user', 'email']);
      expect(result.errors?.[0].message).toContain('email');
    });

    it('should include error codes', () => {
      const schema = adapter.defineSchema({
        age: { type: 'number', required: true, min: 0 },
      });

      const result = adapter.validate(schema, { age: -5 });

      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBeDefined();
    });
  });
});
