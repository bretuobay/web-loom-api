import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../model-registry';
import type { ModelDefinition } from '../types';
import { ConflictError, NotFoundError, ValidationError } from '@web-loom/api-shared';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('register()', () => {
    it('should register a valid model', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'email', type: 'string' },
        ],
      };

      registry.register(model);
      expect(registry.has('User')).toBe(true);
      expect(registry.get('User')).toEqual(model);
    });

    it('should throw ConflictError for duplicate registration', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(() => registry.register(model)).toThrow(ConflictError);
    });

    it('should validate model name is PascalCase', () => {
      const model: ModelDefinition = {
        name: 'user',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should require at least one field', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should validate field names are camelCase', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'FirstName', type: 'string' },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should detect duplicate field names', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'email', type: 'string' },
          { name: 'email', type: 'string' },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should validate field types', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'id', type: 'invalid' as any },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should require enum values for enum fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'role', type: 'enum' },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should accept enum fields with values', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
            validation: { enum: ['admin', 'user'] },
          },
        ],
      };

      registry.register(model);
      expect(registry.has('User')).toBe(true);
    });

    it('should validate table name is snake_case', () => {
      const model: ModelDefinition = {
        name: 'User',
        tableName: 'UserTable',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should accept valid table name', () => {
      const model: ModelDefinition = {
        name: 'User',
        tableName: 'user_table',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.get('User')?.tableName).toBe('user_table');
    });

    it('should validate relationship types', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'invalid' as any, model: 'Post' },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should require through table for manyToMany', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'manyToMany', model: 'Role' },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should accept manyToMany with through table', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'manyToMany', model: 'Role', through: 'user_roles' },
        ],
      };

      registry.register(model);
      expect(registry.has('User')).toBe(true);
    });
  });

  describe('unregister()', () => {
    it('should unregister an existing model', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.has('User')).toBe(true);

      registry.unregister('User');
      expect(registry.has('User')).toBe(false);
    });

    it('should throw NotFoundError for non-existent model', () => {
      expect(() => registry.unregister('NonExistent')).toThrow(NotFoundError);
    });
  });

  describe('get()', () => {
    it('should return model definition', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.get('User')).toEqual(model);
    });

    it('should return undefined for non-existent model', () => {
      expect(registry.get('NonExistent')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no models registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered models', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(user);
      registry.register(post);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(user);
      expect(all).toContainEqual(post);
    });
  });

  describe('has()', () => {
    it('should return true for registered model', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.has('User')).toBe(true);
    });

    it('should return false for non-existent model', () => {
      expect(registry.has('NonExistent')).toBe(false);
    });
  });

  describe('getRelationships()', () => {
    it('should return relationships for a model', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasMany', model: 'Post' },
          { type: 'belongsTo', model: 'Organization' },
        ],
      };

      registry.register(model);
      const relationships = registry.getRelationships('User');
      expect(relationships).toHaveLength(2);
      expect(relationships[0]?.type).toBe('hasMany');
      expect(relationships[1]?.type).toBe('belongsTo');
    });

    it('should return empty array for model without relationships', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.getRelationships('User')).toEqual([]);
    });

    it('should return empty array for non-existent model', () => {
      expect(registry.getRelationships('NonExistent')).toEqual([]);
    });
  });

  describe('getDependencies()', () => {
    it('should return dependencies based on belongsTo relationships', () => {
      const model: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User' },
          { type: 'belongsTo', model: 'Category' },
          { type: 'hasMany', model: 'Comment' }, // Should not be included
        ],
      };

      registry.register(model);
      const dependencies = registry.getDependencies('Post');
      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContain('User');
      expect(dependencies).toContain('Category');
      expect(dependencies).not.toContain('Comment');
    });

    it('should exclude self-references', () => {
      const model: ModelDefinition = {
        name: 'Category',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'Category', as: 'parent' },
        ],
      };

      registry.register(model);
      const dependencies = registry.getDependencies('Category');
      expect(dependencies).toEqual([]);
    });

    it('should return empty array for model without dependencies', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.getDependencies('User')).toEqual([]);
    });

    it('should remove duplicate dependencies', () => {
      const model: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', as: 'author' },
          { type: 'belongsTo', model: 'User', as: 'editor' },
        ],
      };

      registry.register(model);
      const dependencies = registry.getDependencies('Post');
      expect(dependencies).toEqual(['User']);
    });
  });

  describe('getMetadata()', () => {
    it('should return metadata for a model', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        metadata: {
          description: 'User model',
          tags: ['auth', 'user'],
        },
      };

      registry.register(model);
      const metadata = registry.getMetadata('User');
      expect(metadata.description).toBe('User model');
      expect(metadata.tags).toEqual(['auth', 'user']);
    });

    it('should return empty object for model without metadata', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(model);
      expect(registry.getMetadata('User')).toEqual({});
    });

    it('should return empty object for non-existent model', () => {
      expect(registry.getMetadata('NonExistent')).toEqual({});
    });
  });

  describe('resolveDependencyOrder()', () => {
    it('should resolve simple dependency chain', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'User' }],
      };
      const comment: ModelDefinition = {
        name: 'Comment',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'Post' }],
      };

      registry.register(user);
      registry.register(post);
      registry.register(comment);

      const order = registry.resolveDependencyOrder();
      expect(order.indexOf('User')).toBeLessThan(order.indexOf('Post'));
      expect(order.indexOf('Post')).toBeLessThan(order.indexOf('Comment'));
    });

    it('should handle models without dependencies', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const tag: ModelDefinition = {
        name: 'Tag',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(user);
      registry.register(tag);

      const order = registry.resolveDependencyOrder();
      expect(order).toHaveLength(2);
      expect(order).toContain('User');
      expect(order).toContain('Tag');
    });

    it('should detect circular dependencies', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'Post' }],
      };
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'User' }],
      };

      registry.register(user);
      registry.register(post);

      expect(() => registry.resolveDependencyOrder()).toThrow(ValidationError);
      expect(() => registry.resolveDependencyOrder()).toThrow(/circular dependency/i);
    });

    it('should throw error for missing dependency', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'User' }],
      };

      registry.register(post);

      expect(() => registry.resolveDependencyOrder()).toThrow(ValidationError);
      expect(() => registry.resolveDependencyOrder()).toThrow(/not registered/);
    });

    it('should handle complex dependency graph', () => {
      const organization: ModelDefinition = {
        name: 'Organization',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'Organization' }],
      };
      const category: ModelDefinition = {
        name: 'Category',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User' },
          { type: 'belongsTo', model: 'Category' },
        ],
      };
      const comment: ModelDefinition = {
        name: 'Comment',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'Post' },
          { type: 'belongsTo', model: 'User' },
        ],
      };

      registry.register(organization);
      registry.register(user);
      registry.register(category);
      registry.register(post);
      registry.register(comment);

      const order = registry.resolveDependencyOrder();
      
      // Organization and Category have no dependencies, so they come first
      expect(order.indexOf('Organization')).toBeLessThan(order.indexOf('User'));
      expect(order.indexOf('User')).toBeLessThan(order.indexOf('Post'));
      expect(order.indexOf('Category')).toBeLessThan(order.indexOf('Post'));
      expect(order.indexOf('Post')).toBeLessThan(order.indexOf('Comment'));
    });
  });

  describe('clear()', () => {
    it('should remove all registered models', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
      };

      registry.register(user);
      registry.register(post);
      expect(registry.getAll()).toHaveLength(2);

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('thread safety', () => {
    it('should handle concurrent registrations', async () => {
      const models: ModelDefinition[] = Array.from({ length: 10 }, (_, i) => ({
        name: `Model${i}`,
        fields: [{ name: 'id', type: 'uuid' }],
      }));

      // Register all models concurrently
      await Promise.all(models.map((model) => {
        return new Promise<void>((resolve) => {
          registry.register(model);
          resolve();
        });
      }));

      // All models should be registered
      expect(registry.getAll()).toHaveLength(10);
      models.forEach((model) => {
        expect(registry.has(model.name)).toBe(true);
      });
    });
  });
});
