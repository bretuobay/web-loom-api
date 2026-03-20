/**
 * Minimal Example — App Entry Point
 *
 * Bootstraps the Web Loom API. The framework handles:
 * - Connecting to the database (driver from config)
 * - Discovering route files from config.routes.dir
 * - Generating CRUD endpoints for registered models
 * - Starting the HTTP server
 */
import { createApp } from '@web-loom/api-core';
import config from './config';

async function main() {
  const app = await createApp(config);

  const port = Number(process.env.PORT ?? 3000);
  await app.start(port);

  console.log(`Web Loom API running at http://localhost:${port}`);
  console.log(`API docs at http://localhost:${port}/docs`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
