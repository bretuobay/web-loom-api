/**
 * Minimal Example — App Configuration
 *
 * Defines the Web Loom config using only the fields the current API accepts.
 * Database connection and driver are required; everything else is optional.
 */
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'pg',
    poolSize: 5,
  },

  // Route files are auto-discovered from this directory
  routes: { dir: './src/routes' },

  security: {
    cors: {
      origins: ['http://localhost:3000'],
      credentials: true,
    },
  },

  // Enable auto-generated CRUD routes for all registered models
  features: { crud: true },

  development: {
    hotReload: true,
    apiDocs: true,
    detailedErrors: true,
  },

  observability: {
    logging: { level: 'info', format: 'pretty' },
  },
});
