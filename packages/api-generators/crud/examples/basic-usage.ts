/**
 * Basic CRUD Generator Usage Example
 * 
 * This example demonstrates how to use the CRUD generator to automatically
 * create REST API endpoints for a User model.
 */

import { CRUDGenerator } from '@web-loom/api-generator-crud';
import type { ModelDefinition, DatabaseAdapter, APIFrameworkAdapter } from '@web-loom/api-core';

// Define a User model
const UserModel: ModelDefinition = {
  name: 'User',
  tableName: 'users',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      required: true,
      database: { primaryKey: true },
    },
    {
      name: 'name',
      type: 'string',
      required: true,
      validation: { minLength: 2, maxLength: 100 },
    },
    {
      name: 'email',
      type: 'string',
      required: true,
      validation: { email: true },
    },
    {
      name: 'age',
      type: 'number',
      required: false,
      validation: { min: 0, max: 150 },
    },
    {
      name: 'createdAt',
      type: 'date',
      required: true,
      database: { autoGenerate: true },
    },
    {
      name: 'updatedAt',
      type: 'date',
      required: true,
      database: { autoGenerate: true, autoUpdate: true },
    },
  ],
};

/**
 * Example: Generate CRUD routes for User model
 */
export function setupUserCRUD(
  database: DatabaseAdapter,
  apiFramework: APIFrameworkAdapter
): void {
  // Create CRUD generator
  const generator = new CRUDGenerator(database);

  // Generate all 6 CRUD endpoints
  const routes = generator.generate(UserModel, {
    basePath: '/users',
    enablePagination: true,
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  // Register routes with API framework
  routes.forEach(route => {
    console.log(`Registering ${route.method} ${route.path}`);
    apiFramework.registerRoute(route.method, route.path, route.handler);
  });

  console.log(`✓ Generated ${routes.length} CRUD endpoints for User model`);
}

/**
 * Example: Generate CRUD routes with custom options
 */
export function setupProductCRUD(
  database: DatabaseAdapter,
  apiFramework: APIFrameworkAdapter
): void {
  const ProductModel: ModelDefinition = {
    name: 'Product',
    tableName: 'products',
    fields: [
      { name: 'id', type: 'uuid', database: { primaryKey: true } },
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'price', type: 'number', required: true },
      { name: 'stock', type: 'number', required: true },
      { name: 'categoryId', type: 'uuid', required: true },
    ],
  };

  const generator = new CRUDGenerator(database);

  // Generate with custom pagination settings
  const routes = generator.generate(ProductModel, {
    basePath: '/products',
    enablePagination: true,
    defaultPageSize: 50, // Larger default page size
    maxPageSize: 200,    // Higher max limit
  });

  routes.forEach(route => {
    apiFramework.registerRoute(route.method, route.path, route.handler);
  });

  console.log(`✓ Generated ${routes.length} CRUD endpoints for Product model`);
}

/**
 * Example: Multiple models with different configurations
 */
export function setupMultipleModels(
  database: DatabaseAdapter,
  apiFramework: APIFrameworkAdapter
): void {
  const generator = new CRUDGenerator(database);

  // User model - standard pagination
  const userRoutes = generator.generate(UserModel, {
    basePath: '/users',
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  // Post model - larger pagination for content
  const PostModel: ModelDefinition = {
    name: 'Post',
    tableName: 'posts',
    fields: [
      { name: 'id', type: 'uuid', database: { primaryKey: true } },
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true },
      { name: 'authorId', type: 'uuid', required: true },
      { name: 'published', type: 'boolean', required: true },
    ],
  };

  const postRoutes = generator.generate(PostModel, {
    basePath: '/posts',
    defaultPageSize: 10,
    maxPageSize: 50,
  });

  // Register all routes
  [...userRoutes, ...postRoutes].forEach(route => {
    apiFramework.registerRoute(route.method, route.path, route.handler);
  });

  console.log(`✓ Generated CRUD endpoints for ${2} models`);
}
