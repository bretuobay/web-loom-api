/**
 * Minimal Example — App Entry Point
 *
 * Bootstraps the Web Loom API application. The framework handles:
 * - Loading configuration from config.ts
 * - Initializing adapters (Hono, Drizzle, Zod)
 * - Discovering models from src/models/
 * - Discovering routes from src/routes/
 * - Generating CRUD endpoints for registered models
 * - Starting the HTTP server
 */
import { createApp } from '@web-loom/api-core';
import config from './config';

async function main() {
  const app = await createApp(config);

  // The app is ready — models are registered, routes are discovered,
  // and CRUD endpoints are generated automatically.
  await app.start();

  console.log(`🕸️  Web Loom API running at http://localhost:${app.port}`);
  console.log(`📖  API docs at http://localhost:${app.port}/docs`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
