/**
 * Example demonstrating ModelRegistry usage
 *
 * This example shows how to:
 * - Register models with validation
 * - Define relationships between models
 * - Resolve dependency order for initialization
 * - Track and retrieve model metadata
 */

import { ModelRegistry } from '../src/registry';
import type { ModelDefinition } from '../src/registry/types';

// Create a new registry instance
const registry = new ModelRegistry();

// Define a User model
const userModel: ModelDefinition = {
  name: 'User',
  tableName: 'users',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true },
    },
    {
      name: 'email',
      type: 'string',
      validation: { required: true, email: true },
      database: { unique: true },
    },
    {
      name: 'name',
      type: 'string',
      validation: { required: true, min: 2, max: 100 },
    },
    {
      name: 'role',
      type: 'enum',
      validation: { enum: ['admin', 'user', 'guest'] },
      default: 'user',
    },
    {
      name: 'createdAt',
      type: 'date',
      database: { nullable: false },
    },
  ],
  options: {
    timestamps: true,
    softDelete: true,
    crud: true,
  },
  metadata: {
    description: 'User account model',
    tags: ['auth', 'user'],
  },
};

// Define a Post model with relationship to User
const postModel: ModelDefinition = {
  name: 'Post',
  tableName: 'posts',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true },
    },
    {
      name: 'title',
      type: 'string',
      validation: { required: true, min: 5, max: 200 },
    },
    {
      name: 'content',
      type: 'string',
      validation: { required: true },
    },
    {
      name: 'published',
      type: 'boolean',
      default: false,
    },
    {
      name: 'userId',
      type: 'uuid',
      validation: { required: true },
    },
  ],
  relationships: [
    {
      type: 'belongsTo',
      model: 'User',
      foreignKey: 'userId',
      as: 'author',
    },
    {
      type: 'hasMany',
      model: 'Comment',
      foreignKey: 'postId',
    },
  ],
  options: {
    timestamps: true,
    crud: true,
  },
  metadata: {
    description: 'Blog post model',
    tags: ['content', 'blog'],
  },
};

// Define a Comment model with relationships
const commentModel: ModelDefinition = {
  name: 'Comment',
  tableName: 'comments',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      database: { primaryKey: true },
    },
    {
      name: 'content',
      type: 'string',
      validation: { required: true, min: 1, max: 1000 },
    },
    {
      name: 'postId',
      type: 'uuid',
      validation: { required: true },
    },
    {
      name: 'userId',
      type: 'uuid',
      validation: { required: true },
    },
  ],
  relationships: [
    {
      type: 'belongsTo',
      model: 'Post',
      foreignKey: 'postId',
    },
    {
      type: 'belongsTo',
      model: 'User',
      foreignKey: 'userId',
      as: 'author',
    },
  ],
  options: {
    timestamps: true,
    softDelete: true,
  },
  metadata: {
    description: 'Comment on a blog post',
    tags: ['content', 'comment'],
  },
};

// Register models
console.log('Registering models...');
registry.register(userModel);
registry.register(postModel);
registry.register(commentModel);

// Check if models are registered
console.log('\nRegistered models:');
console.log('- User:', registry.has('User'));
console.log('- Post:', registry.has('Post'));
console.log('- Comment:', registry.has('Comment'));

// Get all registered models
console.log(
  '\nAll models:',
  registry.getAll().map((m) => m.name)
);

// Get relationships for a model
console.log('\nPost relationships:');
const postRelationships = registry.getRelationships('Post');
postRelationships.forEach((rel) => {
  console.log(`- ${rel.type} ${rel.model} (as: ${rel.as || 'default'})`);
});

// Get dependencies for a model
console.log('\nComment dependencies:');
const commentDeps = registry.getDependencies('Comment');
console.log('- Depends on:', commentDeps);

// Resolve initialization order
console.log('\nModel initialization order:');
const initOrder = registry.resolveDependencyOrder();
console.log('- Order:', initOrder);
console.log('- Explanation: User has no dependencies, so it comes first.');
console.log('  Post depends on User, so it comes second.');
console.log('  Comment depends on both Post and User, so it comes last.');

// Get model metadata
console.log('\nUser model metadata:');
const userMetadata = registry.getMetadata('User');
console.log('- Description:', userMetadata.description);
console.log('- Tags:', userMetadata.tags);

// Retrieve a specific model
console.log('\nPost model details:');
const post = registry.get('Post');
if (post) {
  console.log('- Name:', post.name);
  console.log('- Table:', post.tableName);
  console.log('- Fields:', post.fields.length);
  console.log('- Relationships:', post.relationships?.length || 0);
  console.log('- CRUD enabled:', post.options?.crud);
}

// Example of validation error
console.log('\n\nTrying to register an invalid model...');
try {
  const invalidModel: ModelDefinition = {
    name: 'invalid', // Should be PascalCase
    fields: [{ name: 'id', type: 'uuid' }],
  };
  registry.register(invalidModel);
} catch (error) {
  console.log('✓ Validation error caught:', (error as Error).message);
}

// Example of duplicate registration error
console.log('\nTrying to register a duplicate model...');
try {
  registry.register(userModel);
} catch (error) {
  console.log('✓ Conflict error caught:', (error as Error).message);
}

console.log('\n✓ ModelRegistry example completed successfully!');
