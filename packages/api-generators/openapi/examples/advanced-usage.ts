/**
 * Advanced OpenAPI Generator Usage Example
 *
 * Demonstrates validation schemas, rate limiting, caching, and authentication
 */

import { OpenAPIGenerator } from '../src';
import type { ModelDefinition, RouteDefinition } from '@web-loom/api-core';

// Define a User model
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
      name: 'role',
      type: 'enum',
      validation: { enum: ['admin', 'user', 'guest'] },
      default: 'user',
    },
    {
      name: 'createdAt',
      type: 'date',
      computed: true,
    },
  ],
  metadata: {
    description: 'User account with role-based access',
    tags: ['Users'],
  },
};

// Define routes with validation, auth, rate limiting, and caching
const routes: RouteDefinition[] = [
  {
    path: '/users',
    method: 'GET',
    handler: async () => new Response(),
    validation: {
      query: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        role: { type: 'string', enum: ['admin', 'user', 'guest'] },
        search: { type: 'string', minLength: 2 },
      },
    },
    rateLimit: {
      limit: 100,
      window: 60000, // 1 minute
    },
    cache: {
      ttl: 300, // 5 minutes
      perUser: false,
    },
    metadata: {
      description: 'List all users with filtering and pagination',
      tags: ['Users'],
      responses: [
        {
          status: 200,
          description: 'List of users',
          schema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/User' },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      ],
    },
  },
  {
    path: '/users',
    method: 'POST',
    handler: async () => new Response(),
    validation: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2, maxLength: 100 },
          role: { type: 'string', enum: ['admin', 'user', 'guest'] },
        },
        required: ['email', 'name'],
      },
    },
    auth: {
      required: true,
      roles: ['admin'],
    },
    rateLimit: {
      limit: 10,
      window: 60000, // 1 minute
    },
    metadata: {
      description: 'Create a new user (admin only)',
      tags: ['Users'],
    },
  },
  {
    path: '/users/:id',
    method: 'GET',
    handler: async () => new Response(),
    validation: {
      params: {
        id: { type: 'string', format: 'uuid' },
      },
      query: {
        include: {
          type: 'array',
          items: { type: 'string', enum: ['posts', 'comments', 'profile'] },
        },
      },
    },
    cache: {
      ttl: 600, // 10 minutes
      perUser: true,
    },
    metadata: {
      description: 'Get user by ID with optional related data',
      tags: ['Users'],
    },
  },
  {
    path: '/users/:id',
    method: 'PUT',
    handler: async () => new Response(),
    validation: {
      params: {
        id: { type: 'string', format: 'uuid' },
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2, maxLength: 100 },
          role: { type: 'string', enum: ['admin', 'user', 'guest'] },
        },
      },
    },
    auth: {
      required: true,
      scopes: ['user:write'],
    },
    rateLimit: {
      limit: 20,
      window: 60000,
    },
    metadata: {
      description: 'Update user information',
      tags: ['Users'],
    },
  },
  {
    path: '/users/:id',
    method: 'DELETE',
    handler: async () => new Response(),
    validation: {
      params: {
        id: { type: 'string', format: 'uuid' },
      },
    },
    auth: {
      required: true,
      roles: ['admin'],
    },
    rateLimit: {
      limit: 5,
      window: 60000,
    },
    metadata: {
      description: 'Delete a user (admin only)',
      tags: ['Users'],
    },
  },
];

// Create generator with security schemes
const generator = new OpenAPIGenerator({
  title: 'Advanced User Management API',
  version: '2.0.0',
  description: 'Comprehensive API with authentication, rate limiting, and caching',
  servers: [
    {
      url: 'https://api.example.com/v2',
      description: 'Production server',
    },
    {
      url: 'https://staging-api.example.com/v2',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000/v2',
      description: 'Development server',
    },
  ],
  contact: {
    name: 'API Support Team',
    email: 'api-support@example.com',
    url: 'https://example.com/support',
  },
  license: {
    name: 'Apache 2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
  },
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT token authentication',
    },
    apiKey: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API key for service-to-service authentication',
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    {
      name: 'Users',
      description: 'User management operations with role-based access control',
    },
  ],
  externalDocs: {
    description: 'Complete API documentation',
    url: 'https://docs.example.com/api',
  },
  includeExamples: true,
});

// Register models and routes
generator.registerModel(UserModel);
generator.registerRoutes(routes);

// Generate specification
const spec = generator.generate();

// Output as JSON
console.log('=== OpenAPI Specification (JSON) ===');
console.log(generator.toJSON());

// Show specific features
console.log('\n=== Rate Limiting Configuration ===');
const getUsersOp = spec.paths['/users']?.get;
if (getUsersOp && 'x-rate-limit' in getUsersOp) {
  console.log(JSON.stringify((getUsersOp as Record<string, unknown>)['x-rate-limit'], null, 2));
}

console.log('\n=== Caching Configuration ===');
if (getUsersOp && 'x-cache' in getUsersOp) {
  console.log(JSON.stringify((getUsersOp as Record<string, unknown>)['x-cache'], null, 2));
}

console.log('\n=== Security Requirements ===');
const createUserOp = spec.paths['/users']?.post;
if (createUserOp?.security) {
  console.log(JSON.stringify(createUserOp.security, null, 2));
}

console.log('\n=== Error Response Schema (400) ===');
if (createUserOp?.responses['400']) {
  console.log(JSON.stringify(createUserOp.responses['400'], null, 2));
}

console.log('\n=== Validation Parameters ===');
const getUserByIdOp = spec.paths['/users/{id}']?.get;
if (getUserByIdOp?.parameters) {
  console.log(JSON.stringify(getUserByIdOp.parameters, null, 2));
}
