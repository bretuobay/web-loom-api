/**
 * Tests for the model system: defineModel, ModelRegistry, serializeModel
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { defineModel } from '../define-model';
import { ModelRegistry, modelRegistry } from '../registry';
import { serializeModel } from '../serialize';
import { DuplicateModelError } from '../../errors/duplicate-model-error';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const postsTable = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body'),
});

// ---------------------------------------------------------------------------
// ModelRegistry
// ---------------------------------------------------------------------------

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  it('registers a model and retrieves it by name', () => {
    const model = {
      table: usersTable,
      insertSchema: z.object({}),
      selectSchema: z.object({}),
      updateSchema: z.object({}),
      meta: { name: 'User', basePath: '/users', crud: false as const },
      $inferSelect: undefined as never,
      $inferInsert: undefined as never,
    };
    registry.register(model);
    expect(registry.has('User')).toBe(true);
    expect(registry.get('User')).toBe(model);
  });

  it('getAll returns all registered models', () => {
    const userModel = {
      table: usersTable,
      insertSchema: z.object({}),
      selectSchema: z.object({}),
      updateSchema: z.object({}),
      meta: { name: 'User', basePath: '/users', crud: false as const },
      $inferSelect: undefined as never,
      $inferInsert: undefined as never,
    };
    registry.register(userModel);
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getAll()[0]).toBe(userModel);
  });

  it('throws DuplicateModelError on double registration', () => {
    const model = {
      table: usersTable,
      insertSchema: z.object({}),
      selectSchema: z.object({}),
      updateSchema: z.object({}),
      meta: { name: 'User', basePath: '/users', crud: false as const },
      $inferSelect: undefined as never,
      $inferInsert: undefined as never,
    };
    registry.register(model);
    expect(() => registry.register(model)).toThrow(DuplicateModelError);
    expect(() => registry.register(model)).toThrow(/User/);
  });

  it('clear() empties the registry', () => {
    const model = {
      table: usersTable,
      insertSchema: z.object({}),
      selectSchema: z.object({}),
      updateSchema: z.object({}),
      meta: { name: 'User', basePath: '/users', crud: false as const },
      $inferSelect: undefined as never,
      $inferInsert: undefined as never,
    };
    registry.register(model);
    registry.clear();
    expect(registry.has('User')).toBe(false);
    expect(registry.getAll()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// defineModel
// ---------------------------------------------------------------------------

describe('defineModel', () => {
  // Use the global singleton but isolate each test
  beforeEach(() => modelRegistry.clear());
  afterEach(() => modelRegistry.clear());

  it('returns a Model with table, insertSchema, selectSchema, updateSchema, meta', () => {
    const User = defineModel(usersTable, { name: 'User' });

    expect(User.table).toBe(usersTable);
    expect(User.insertSchema).toBeDefined();
    expect(User.selectSchema).toBeDefined();
    expect(User.updateSchema).toBeDefined();
    expect(User.meta.name).toBe('User');
    expect(User.meta.basePath).toBe('/users');
    expect(User.meta.crud).toBe(false);
  });

  it('derives valid Zod schemas from a pgTable', () => {
    const User = defineModel(usersTable, { name: 'User' });

    // insertSchema should require non-nullable fields
    const insertResult = User.insertSchema.safeParse({ name: 'Alice', email: 'a@b.com' });
    expect(insertResult.success).toBe(true);

    // updateSchema should accept a partial payload
    const updateResult = User.updateSchema.safeParse({ name: 'Bob' });
    expect(updateResult.success).toBe(true);

    // updateSchema should accept an empty object (all fields optional)
    const emptyUpdate = User.updateSchema.safeParse({});
    expect(emptyUpdate.success).toBe(true);
  });

  it('derives valid Zod schemas from a sqliteTable', () => {
    const Post = defineModel(postsTable, { name: 'Post' });

    // Schemas are derived ZodObjects
    expect(Post.insertSchema).toBeDefined();
    expect(Post.selectSchema).toBeDefined();
    expect(Post.updateSchema).toBeDefined();

    // updateSchema should accept partial payload (all optional)
    const updateResult = Post.updateSchema.safeParse({ title: 'New title' });
    expect(updateResult.success).toBe(true);
    const emptyUpdate = Post.updateSchema.safeParse({});
    expect(emptyUpdate.success).toBe(true);
  });

  it('auto-registers with the global modelRegistry', () => {
    defineModel(usersTable, { name: 'User' });
    expect(modelRegistry.has('User')).toBe(true);
  });

  it('uses provided basePath', () => {
    const User = defineModel(usersTable, { name: 'User', basePath: '/api/v1/users' });
    expect(User.meta.basePath).toBe('/api/v1/users');
  });

  it('defaults basePath to /<name.lower>s', () => {
    const Post = defineModel(postsTable, { name: 'Post' });
    expect(Post.meta.basePath).toBe('/posts');
  });

  it('throws DuplicateModelError on double defineModel() with same name', () => {
    defineModel(usersTable, { name: 'User' });
    expect(() => defineModel(usersTable, { name: 'User' })).toThrow(DuplicateModelError);
  });

  it('applies insert schema override', () => {
    const User = defineModel(usersTable, { name: 'User' }, {
      insert: (schema) => schema.extend({ email: z.string().email() }),
    });

    const invalid = User.insertSchema.safeParse({ name: 'Alice', email: 'not-an-email' });
    expect(invalid.success).toBe(false);

    const valid = User.insertSchema.safeParse({ name: 'Alice', email: 'alice@example.com' });
    expect(valid.success).toBe(true);
  });

  it('applies update schema override', () => {
    const User = defineModel(usersTable, { name: 'User' }, {
      update: (schema) => schema.extend({ email: z.string().email().optional() }),
    });

    const invalid = User.updateSchema.safeParse({ email: 'bad-email' });
    expect(invalid.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// serializeModel
// ---------------------------------------------------------------------------

describe('serializeModel', () => {
  it('passes through primitives unchanged', () => {
    expect(serializeModel(42)).toBe(42);
    expect(serializeModel('hello')).toBe('hello');
    expect(serializeModel(true)).toBe(true);
    expect(serializeModel(null)).toBe(null);
    expect(serializeModel(undefined)).toBe(undefined);
  });

  it('converts Date to ISO 8601 string', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    expect(serializeModel(d)).toBe('2024-01-15T12:00:00.000Z');
  });

  it('converts BigInt to string', () => {
    // Use string constructor to avoid JS float precision loss
    expect(serializeModel(BigInt('9007199254740993'))).toBe('9007199254740993');
  });

  it('converts Buffer to base64 string', () => {
    const buf = Buffer.from('hello');
    expect(serializeModel(buf)).toBe(buf.toString('base64'));
  });

  it('recursively serializes arrays', () => {
    const d = new Date('2024-01-15T00:00:00.000Z');
    expect(serializeModel([1, d, 'text'])).toEqual([1, '2024-01-15T00:00:00.000Z', 'text']);
  });

  it('recursively serializes plain objects', () => {
    const d = new Date('2024-06-01T00:00:00.000Z');
    const result = serializeModel({ name: 'Alice', createdAt: d, count: BigInt(5) });
    expect(result).toEqual({ name: 'Alice', createdAt: '2024-06-01T00:00:00.000Z', count: '5' });
  });

  it('handles nested objects with mixed types', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    const result = serializeModel({
      user: { name: 'Bob', createdAt: d },
      tags: ['a', 'b'],
    });
    expect(result).toEqual({
      user: { name: 'Bob', createdAt: '2024-01-01T00:00:00.000Z' },
      tags: ['a', 'b'],
    });
  });
});
