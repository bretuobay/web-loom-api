/**
 * Full-Stack Example — Post Created Webhook
 *
 * Uses WebhookManager from @web-loom/api-webhooks directly.
 * `defineWebhook` does not exist — create a WebhookManager instance,
 * register subscribers, and call manager.dispatch() from route handlers.
 *
 * Constructor options: { webhookStore, logStore, transport, deliveryOptions }
 * Dispatch method: manager.dispatch(event, payload)
 * Register method: manager.create(options)  ← WebhookCreateOptions
 */
import { WebhookManager, MemoryWebhookStore, MemoryDeliveryLogStore } from '@web-loom/api-webhooks';

export const webhookManager = new WebhookManager({
  webhookStore: new MemoryWebhookStore(),
  logStore: new MemoryDeliveryLogStore(),
});

interface PostCreatedPayload {
  postId: string;
  title: string;
  authorId: string;
}

/**
 * Dispatch a post.created event. Call this from POST /posts after insert.
 * Returns delivery results for each registered subscriber.
 */
export async function dispatchPostCreated(payload: PostCreatedPayload) {
  return webhookManager.dispatch('post.created', {
    event: 'post.created',
    timestamp: new Date().toISOString(),
    data: payload,
  });
}

/**
 * Register a webhook subscriber (call at startup or load from DB in production).
 *
 * Example:
 *   await registerSubscriber({
 *     url: 'https://hooks.example.com/endpoint',
 *     secret: process.env.WEBHOOK_SECRET!,
 *     events: ['post.created'],
 *   });
 */
export async function registerSubscriber(opts: { url: string; secret?: string; events: string[] }) {
  return webhookManager.create({
    url: opts.url,
    events: opts.events,
    secret: opts.secret,
  });
}
