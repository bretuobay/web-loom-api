/**
 * Basic Usage Example
 * 
 * Demonstrates basic type generation from model definitions
 */

import { TypeGenerator } from '../src/type-generator';
import type { ModelDefinition } from '../src/types';

// Define models
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'age', type: 'number', required: false },
      { name: 'isActive', type: 'boolean', required: true },
      { name: 'createdAt', type: 'date', required: true },
      { name: 'updatedAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'User model',
      tableName: 'users',
      timestamps: true,
    },
  },
  {
    name: 'Post',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
      { name: 'published', type: 'boolean', required: true },
      { name: 'authorId', type: 'uuid', required: true },
      { name: 'tags', type: 'array', required: false, arrayItemType: 'string' },
      { name: 'metadata', type: 'json', required: false },
      { name: 'views', type: 'number', required: true, default: 0 },
      { name: 'createdAt', type: 'date', required: true },
      { name: 'updatedAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'Blog post model',
      tableName: 'posts',
      timestamps: true,
    },
  },
];

// Create generator
const generator = new TypeGenerator({
  includeJSDoc: true,
  generateEnums: true,
  generateRequestResponseTypes: true,
  generateUtilityTypes: true,
});

// Register models
generator.registerModels(models);

// Generate types
const files = generator.generateToFiles();

// Output generated files
console.log('Generated files:');
for (const [filename, content] of files) {
  console.log(`\n=== ${filename} ===`);
  console.log(content.substring(0, 500) + '...\n');
}

// Example usage of generated types:
/*
import type {
  User,
  CreateUser,
  UpdateUser,
  Post,
  CreatePost,
  UpdatePost,
  DeepPartial,
  Prettify,
} from './generated';

// Use base types
const user: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  name: 'John Doe',
  age: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Use Create type (no id, timestamps)
const newUser: CreateUser = {
  email: 'newuser@example.com',
  name: 'Jane Doe',
  age: 25,
  isActive: true,
};

// Use Update type (all fields optional)
const userUpdate: UpdateUser = {
  name: 'Jane Smith',
  age: 26,
};

// Use with posts
const newPost: CreatePost = {
  title: 'My First Post',
  content: 'This is the content',
  published: false,
  authorId: user.id,
  tags: ['typescript', 'api'],
  metadata: { category: 'tech' },
  views: 0,
};

// Use utility types
const partialUser: DeepPartial<User> = {
  name: 'Partial Name',
};

const prettifiedUser: Prettify<User> = user;
*/
