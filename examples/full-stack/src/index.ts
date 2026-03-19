/**
 * Full-Stack Example — App Entry Point
 *
 * Bootstraps the application. Route files are auto-discovered from
 * config.routes.dir. Webhook subscribers and jobs are set up after
 * app.start() — they are independent of the Application instance.
 */
import { createApp } from '@web-loom/api-core';
import config from './config';
import { registerSubscriber } from './webhooks/post-created';

async function main() {
  const app = await createApp(config);

  const port = Number(process.env.PORT ?? 3000);
  await app.start(port);

  console.log(`Web Loom API running at http://localhost:${port}`);
  console.log(`API docs at http://localhost:${port}/docs`);
  console.log(`Metrics at http://localhost:${port}/metrics`);

  // Register webhook subscribers (in production, load from database)
  if (process.env.WEBHOOK_URL) {
    await registerSubscriber({
      url: process.env.WEBHOOK_URL,
      secret: process.env.WEBHOOK_SECRET!,
      events: ['post.created'],
    });
  }
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
