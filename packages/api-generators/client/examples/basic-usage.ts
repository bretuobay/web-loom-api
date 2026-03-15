/**
 * Basic Usage Example
 * 
 * Demonstrates basic TypeScript client generation and usage
 */

import { ClientGenerator } from '../src/client-generator';
import type { ModelDefinition, RouteDefinition } from '../src/types';

// Define models
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'createdAt', type: 'date', required: true },
      { name: 'updatedAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'User model',
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
      { name: 'createdAt', type: 'date', required: true },
    ],
    metadata: {
      description: 'Blog post model',
    },
  },
];

// Define routes
const routes: RouteDefinition[] = [
  // User routes
  { path: '/users', method: 'GET', metadata: { description: 'List all users' } },
  { path: '/users', method: 'POST', metadata: { description: 'Create a new user' } },
  { path: '/users/:id', method: 'GET', metadata: { description: 'Get user by ID' } },
  { path: '/users/:id', method: 'PUT', metadata: { description: 'Update user' } },
  { path: '/users/:id', method: 'DELETE', metadata: { description: 'Delete user' } },
  
  // Post routes
  { path: '/posts', method: 'GET', metadata: { description: 'List all posts' } },
  { path: '/posts', method: 'POST', metadata: { description: 'Create a new post' } },
  { path: '/posts/:id', method: 'GET', metadata: { description: 'Get post by ID' } },
  { path: '/posts/:id', method: 'PUT', metadata: { description: 'Update post' } },
  { path: '/posts/:id', method: 'DELETE', metadata: { description: 'Delete post' } },
];

// Create generator
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
  includeRetry: true,
  generateErrors: true,
  includeInterceptors: true,
  includeCancellation: true,
  includeJSDoc: true,
});

// Register models and routes
generator.registerModels(models);
generator.registerRoutes(routes);

// Generate client files
const files = generator.generateToFiles();

// Output generated files
console.log('Generated files:');
for (const [filename, content] of files) {
  console.log(`\n=== ${filename} ===`);
  console.log(content.substring(0, 500) + '...\n');
}

// Example usage of generated client:
/*
import { APIClient } from './generated';

const client = new APIClient('https://api.example.com');

// List users with pagination
const users = await client.getUsers({ page: 1, limit: 20 });
console.log(users.data); // User[]
console.log(users.pagination); // { page, limit, total, totalPages }

// Get user by ID
const user = await client.getUserById('user-id');
console.log(user); // User

// Create new user
const newUser = await client.createUsers({
  email: 'user@example.com',
  name: 'John Doe',
});
console.log(newUser); // User

// Update user
const updatedUser = await client.updateUserById('user-id', {
  name: 'Jane Doe',
});
console.log(updatedUser); // User

// Delete user
await client.deleteUserById('user-id');
// Returns void

// Error handling
try {
  await client.getUserById('invalid-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('User not found');
  }
}
*/
