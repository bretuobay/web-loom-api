/**
 * Minimal Example — App Configuration
 *
 * Defines the Web Loom config with sensible defaults.
 * Adapters are selected here: Hono for HTTP, Drizzle for DB, Zod for validation.
 */
import { defineConfig } from "@web-loom/api-core";
import { honoAdapter } from "@web-loom/api-adapter-hono";
import { drizzleAdapter } from "@web-loom/api-adapter-drizzle";
import { zodAdapter } from "@web-loom/api-adapter-zod";

export default defineConfig({
  // Adapter selection — swap any of these without changing app code
  adapters: {
    api: honoAdapter(),
    database: drizzleAdapter(),
    validation: zodAdapter(),
  },

  // Database connection
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 5,
  },

  // Security defaults
  security: {
    cors: {
      origin: ["http://localhost:3000"],
      credentials: true,
    },
  },

  // Enable auto-generated CRUD routes for all models
  features: {
    crud: true,
  },

  // Development niceties
  development: {
    hotReload: true,
    apiDocs: true,
    detailedErrors: true,
  },

  // Basic logging
  observability: {
    logging: {
      level: "info",
      format: "pretty",
    },
  },
});
