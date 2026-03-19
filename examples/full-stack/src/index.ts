/**
 * Full-Stack Example — App Entry Point
 *
 * Bootstraps a production-ready Web Loom API with:
 * - Multiple models with relationships
 * - Session + API key authentication
 * - Role-based access control
 * - Caching with tag-based invalidation
 * - File uploads
 * - Background jobs
 * - Webhooks
 */
import { createApp } from '@web-loom/api-core';
import config from './config';

async function main() {
  const app = await createApp(config);

  // Register webhook subscribers (in production, these come from a database)
  app.webhooks.subscribe({
    url: 'https://hooks.example.com/web-loom',
    secret: process.env.WEBHOOK_SECRET!,
    events: ['post.created'],
  });

  await app.start();

  console.log(`🕸️  Web Loom API running at http://localhost:${app.port}`);
  console.log(`📖  API docs at http://localhost:${app.port}/docs`);
  console.log(`📊  Metrics at http://localhost:${app.port}/metrics`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
