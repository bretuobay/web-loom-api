/**
 * Basic OpenAPI Generator Usage Example
 */

import { OpenAPIGenerator } from '../src';
import type { ModelDefinition, RouteDefinition } from '@web-loom/api-core';

// Define a sample model
const UserModel: ModelDefinition = {
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
      name: 'age',
      type: 'number',
      validation: { min: 0, max: 150 },
    },
    {
      name: 'isActive',
      type: 'boolean',
      default: true,
    },
    {
      name: 'createdAt',
      type: 'date',
      computed: true,
    },
    {
      name: 'updatedAt',
      type: 'date',
      computed: true,
    },
  ],
  metadata: {
    description: 'User account information',
    tags: ['Users'],
  },
};

// Define sample routes
const routes: RouteDefinition[] = [
  {
    path: '/users',
    method: 'GET',
    handler: async () => new Response(),
    metadata: {
      description: 'List all users',
      tags: ['Users'],
    },
  },
  {
    path: '/users',
    method: 'POST',
    handler: async () => new Response(),
    metadata: {
      description: 'Create a new user',
      tags: ['Users'],
    },
  },
  {
    path: '/users/:id',
    method: 'GET',
    handler: async () => new Response(),
    metadata: {
      description: 'Get user by ID',
      tags: ['Users'],
    },
  },
  {
    path: '/users/:id',
    method: 'PUT',
    handler: async () => new Response(),
    metadata: {
      description: 'Update user',
      tags: ['Users'],
    },
  },
  {
    path: '/users/:id',
    method: 'DELETE',
    handler: async () => new Response(),
    metadata: {
      description: 'Delete user',
      tags: ['Users'],
    },
  },
];

// Create generator
const generator = new OpenAPIGenerator({
  title: 'User Management API',
  version: '1.0.0',
  description: 'API for managing user accounts',
  servers: [
    {
      url: 'https://api.example.com',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  contact: {
    name: 'API Support',
    email: 'support@example.com',
    url: 'https://example.com/support',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
  tags: [
    {
      name: 'Users',
      description: 'User management operations',
    },
  ],
});

// Register models and routes
generator.registerModel(UserModel);
generator.registerRoutes(routes);

// Generate specification
const spec = generator.generate();

// Output as JSON
console.log('=== OpenAPI Specification (JSON) ===');
console.log(generator.toJSON());

// Output as YAML
console.log('\n=== OpenAPI Specification (YAML) ===');
console.log(generator.toYAML());

// Access specific parts of the spec
console.log('\n=== Paths ===');
console.log(JSON.stringify(spec.paths, null, 2));

console.log('\n=== Schemas ===');
console.log(JSON.stringify(spec.components?.schemas, null, 2));
