import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../model-registry';
import type { ModelDefinition } from '../types';
import { ValidationError } from '@webloom/api-shared';

/**
 * Helper function to check if a validation error contains a specific message
 */
function expectValidationError(fn: () => void, messagePattern: RegExp): void {
  try {
    fn();
    expect.fail('Should have thrown ValidationError');
  } catch (error: any) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fields).toBeDefined();
    
    // Check if any field error message matches the pattern
    const hasMatchingMessage = error.fields.some((field: any) => 
      messagePattern.test(field.message)
    );
    
    if (!hasMatchingMessage) {
      const messages = error.fields.map((f: any) => f.message).join(', ');
      throw new Error(
        `Expected validation error to match ${messagePattern}, but got messages: ${messages}`
      );
    }
  }
}

describe('ModelRegistry - Validation', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('Field Type Validation', () => {
    it('should accept all valid field types', () => {
      const validTypes = ['string', 'number', 'boolean', 'date', 'uuid', 'enum', 'json', 'array', 'decimal'];
      
      validTypes.forEach((type) => {
        const model: ModelDefinition = {
          name: `Model${type}`,
          fields: [
            {
              name: 'testField',
              type: type as any,
              ...(type === 'enum' ? { validation: { enum: ['value1', 'value2'] } } : {}),
            },
          ],
        };

        expect(() => registry.register(model)).not.toThrow();
        registry.unregister(`Model${type}`);
      });
    });

    it('should reject invalid field types', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'field', type: 'invalid_type' as any },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Field type must be one of/
      );
    });

    it('should reject missing field type', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          { name: 'field' } as any,
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });
  });

  describe('Field Constraint Validation', () => {
    it('should accept valid min constraint', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { min: 0 },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject negative min constraint', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { min: -1 },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Min constraint must be a non-negative number/
      );
    });

    it('should reject non-numeric min constraint', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { min: 'invalid' as any },
          },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should accept valid max constraint', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { max: 100 },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject negative max constraint', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { max: -1 },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Max constraint must be a non-negative number/
      );
    });

    it('should reject min > max', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { min: 100, max: 10 },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Min constraint must be less than or equal to max/
      );
    });

    it('should accept min === max', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { min: 18, max: 18 },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should accept valid regex pattern', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'email',
            type: 'string',
            validation: { pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject invalid regex pattern', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'email',
            type: 'string',
            validation: { pattern: '[invalid(regex' },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Pattern must be a valid regular expression/
      );
    });

    it('should reject non-string pattern', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'email',
            type: 'string',
            validation: { pattern: 123 as any },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Pattern must be a string/
      );
    });
  });

  describe('Type-Specific Validation Constraints', () => {
    it('should accept email validation on string fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'email',
            type: 'string',
            validation: { email: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject email validation on non-string fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { email: true },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Email validation can only be used with string fields/
      );
    });

    it('should accept url validation on string fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'website',
            type: 'string',
            validation: { url: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject url validation on non-string fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { url: true },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /URL validation can only be used with string fields/
      );
    });

    it('should accept integer validation on number fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { integer: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should accept integer validation on decimal fields', () => {
      const model: ModelDefinition = {
        name: 'Product',
        fields: [
          {
            name: 'quantity',
            type: 'decimal',
            validation: { integer: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject integer validation on non-numeric fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'name',
            type: 'string',
            validation: { integer: true },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Integer validation can only be used with number or decimal fields/
      );
    });

    it('should accept positive validation on number fields', () => {
      const model: ModelDefinition = {
        name: 'Product',
        fields: [
          {
            name: 'price',
            type: 'number',
            validation: { positive: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject positive validation on non-numeric fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'name',
            type: 'string',
            validation: { positive: true },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Positive validation can only be used with number or decimal fields/
      );
    });

    it('should accept uuid validation on uuid fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'uuid',
            validation: { uuid: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should accept uuid validation on string fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'externalId',
            type: 'string',
            validation: { uuid: true },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject uuid validation on non-uuid/string fields', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'age',
            type: 'number',
            validation: { uuid: true },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /UUID validation can only be used with uuid or string fields/
      );
    });
  });

  describe('Enum Field Validation', () => {
    it('should accept enum with valid values', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
            validation: { enum: ['admin', 'user', 'guest'] },
          },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should reject enum without values', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Enum fields must specify allowed values/
      );
    });

    it('should reject enum with empty array', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
            validation: { enum: [] },
          },
        ],
      };

      expect(() => registry.register(model)).toThrow(ValidationError);
    });

    it('should reject enum with non-string values', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
            validation: { enum: ['admin', 123, 'user'] as any },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Enum values must be non-empty strings/
      );
    });

    it('should reject enum with empty string values', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
            validation: { enum: ['admin', '', 'user'] },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Enum values must be non-empty strings/
      );
    });

    it('should reject enum with duplicate values', () => {
      const model: ModelDefinition = {
        name: 'User',
        fields: [
          {
            name: 'role',
            type: 'enum',
            validation: { enum: ['admin', 'user', 'admin'] },
          },
        ],
      };

      expectValidationError(
        () => registry.register(model),
        /Enum values must be unique/
      );
    });
  });

  describe('Relationship Validation', () => {
    it('should accept valid hasOne relationship', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
      };
      const profile: ModelDefinition = {
        name: 'Profile',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasOne', model: 'User' },
        ],
      };

      registry.register(user);
      expect(() => registry.register(profile)).not.toThrow();
    });

    it('should accept valid hasMany relationship', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasMany', model: 'Post' },
        ],
      };

      expect(() => registry.register(user)).not.toThrow();
    });

    it('should accept valid belongsTo relationship', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User' },
        ],
      };

      expect(() => registry.register(post)).not.toThrow();
    });

    it('should accept valid manyToMany relationship with through table', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'manyToMany', model: 'Role', through: 'user_roles' },
        ],
      };

      expect(() => registry.register(user)).not.toThrow();
    });

    it('should reject manyToMany without through table', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'manyToMany', model: 'Role' },
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /manyToMany relationships must specify a "through" table/
      );
    });

    it('should reject manyToMany with empty through table', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'manyToMany', model: 'Role', through: '' },
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /Through table must be a non-empty string/
      );
    });

    it('should reject through table not in snake_case', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'manyToMany', model: 'Role', through: 'UserRoles' },
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /Through table name must be snake_case/
      );
    });

    it('should reject invalid relationship type', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'invalidType' as any, model: 'Post' },
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /Relationship type must be one of/
      );
    });

    it('should reject relationship with missing model', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasMany' } as any,
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /Relationship must reference a model name/
      );
    });

    it('should reject relationship with non-PascalCase model name', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasMany', model: 'post' },
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /Referenced model name must be PascalCase/
      );
    });

    it('should accept valid foreignKey', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', foreignKey: 'userId' },
        ],
      };

      expect(() => registry.register(post)).not.toThrow();
    });

    it('should reject foreignKey not in camelCase', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', foreignKey: 'user_id' },
        ],
      };

      expectValidationError(
        () => registry.register(post),
        /Foreign key must be camelCase/
      );
    });

    it('should reject empty foreignKey', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', foreignKey: '' },
        ],
      };

      expectValidationError(
        () => registry.register(post),
        /Foreign key must be a non-empty string/
      );
    });

    it('should accept valid localKey', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasMany', model: 'Post', localKey: 'id' },
        ],
      };

      expect(() => registry.register(user)).not.toThrow();
    });

    it('should reject localKey not in camelCase', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'hasMany', model: 'Post', localKey: 'user_id' },
        ],
      };

      expectValidationError(
        () => registry.register(user),
        /Local key must be camelCase/
      );
    });

    it('should accept valid relationship alias', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', as: 'author' },
        ],
      };

      expect(() => registry.register(post)).not.toThrow();
    });

    it('should reject alias not in camelCase', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', as: 'PostAuthor' },
        ],
      };

      expectValidationError(
        () => registry.register(post),
        /Relationship alias must be camelCase/
      );
    });

    it('should reject empty alias', () => {
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'User', as: '' },
        ],
      };

      expectValidationError(
        () => registry.register(post),
        /Relationship alias must be a non-empty string/
      );
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependency', () => {
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

    it('should detect complex circular dependency', () => {
      const a: ModelDefinition = {
        name: 'A',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'B' }],
      };
      const b: ModelDefinition = {
        name: 'B',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'C' }],
      };
      const c: ModelDefinition = {
        name: 'C',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'A' }],
      };

      registry.register(a);
      registry.register(b);
      registry.register(c);

      expect(() => registry.resolveDependencyOrder()).toThrow(ValidationError);
      expect(() => registry.resolveDependencyOrder()).toThrow(/circular dependency/i);
    });

    it('should allow self-referencing relationships', () => {
      const category: ModelDefinition = {
        name: 'Category',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [
          { type: 'belongsTo', model: 'Category', as: 'parent' },
          { type: 'hasMany', model: 'Category', as: 'children' },
        ],
      };

      registry.register(category);
      expect(() => registry.resolveDependencyOrder()).not.toThrow();
    });

    it('should handle hasMany and hasOne without circular dependency', () => {
      const user: ModelDefinition = {
        name: 'User',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'hasMany', model: 'Post' }],
      };
      const post: ModelDefinition = {
        name: 'Post',
        fields: [{ name: 'id', type: 'uuid' }],
        relationships: [{ type: 'belongsTo', model: 'User' }],
      };

      registry.register(user);
      registry.register(post);

      // This should NOT throw because hasMany doesn't create a dependency
      expect(() => registry.resolveDependencyOrder()).not.toThrow();
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate model with multiple constraints', () => {
      const model: ModelDefinition = {
        name: 'User',
        tableName: 'users',
        fields: [
          {
            name: 'id',
            type: 'uuid',
            validation: { required: true },
          },
          {
            name: 'email',
            type: 'string',
            validation: {
              required: true,
              email: true,
              min: 5,
              max: 255,
            },
          },
          {
            name: 'age',
            type: 'number',
            validation: {
              min: 0,
              max: 150,
              integer: true,
              positive: true,
            },
          },
          {
            name: 'role',
            type: 'enum',
            validation: {
              enum: ['admin', 'user', 'guest'],
            },
          },
        ],
        relationships: [
          { type: 'hasMany', model: 'Post', as: 'posts' },
          { type: 'belongsTo', model: 'Organization', foreignKey: 'organizationId' },
        ],
      };

      expect(() => registry.register(model)).not.toThrow();
    });

    it('should accumulate multiple validation errors', () => {
      const model: ModelDefinition = {
        name: 'invalid_name',
        tableName: 'InvalidTable',
        fields: [
          {
            name: 'InvalidField',
            type: 'invalid' as any,
            validation: {
              min: -5,
              max: 2,
              pattern: '[invalid',
            },
          },
          {
            name: 'role',
            type: 'enum',
          },
        ],
        relationships: [
          {
            type: 'invalid' as any,
            model: 'invalid_model',
            foreignKey: 'Invalid_Key',
          },
        ],
      };

      try {
        registry.register(model);
        expect.fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        // Should have multiple errors
        expect(error.fields).toBeDefined();
        expect(error.fields.length).toBeGreaterThan(5);
      }
    });
  });
});
