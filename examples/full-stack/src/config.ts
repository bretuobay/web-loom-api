/**
 * Full-Stack Example — App Configuration
 *
 * Production-ready config. Adapters are no longer declared here — the
 * database driver is specified directly. Email is optional; when provided
 * it must implement the EmailAdapter interface.
 */
import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL!,
    driver: 'neon-serverless',
    poolSize: 1,
  },

  routes: { dir: './src/routes' },

  openapi: {
    enabled: true,
    ui: 'scalar',
    title: 'Full-Stack API',
    version: '1.0.0',
  },

  security: {
    cors: {
      origins: [process.env.FRONTEND_URL!],
      credentials: true,
    },
    // window accepts: '30s' | '1m' | '1h' | '1d'
    rateLimit: {
      window: '1m',
      limit: 100,
    },
  },

  features: {
    crud: true,
    caching: true,
    auditLogging: true,
  },

  observability: {
    logging: { level: 'info', format: 'json' },
    metrics: { enabled: true, endpoint: '/metrics' },
  },

  development: {
    hotReload: true,
    apiDocs: true,
    detailedErrors: true,
  },
});
