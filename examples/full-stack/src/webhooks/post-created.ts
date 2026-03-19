/**
 * Full-Stack Example — Post Created Webhook
 *
 * Defines a webhook that fires when a new post is created.
 * External services can subscribe to this event to receive real-time
 * notifications (e.g., a Slack bot, analytics pipeline, or CMS).
 */
import { defineWebhook } from '@web-loom/api-core';

interface PostCreatedPayload {
  postId: string;
  title: string;
  authorId: string;
}

export default defineWebhook<PostCreatedPayload>({
  // Event name — matches the key used in ctx.webhooks.dispatch()
  event: 'post.created',

  // Optional: transform the payload before sending to subscribers
  transform: (payload) => ({
    event: 'post.created',
    timestamp: new Date().toISOString(),
    data: {
      postId: payload.postId,
      title: payload.title,
      authorId: payload.authorId,
    },
  }),

  // Optional: filter which subscribers receive this event
  filter: (subscriber, payload) => {
    // Only send to subscribers that have opted into post events
    return subscriber.events.includes('post.created') || subscriber.events.includes('*');
  },

  // Delivery configuration
  delivery: {
    // Retry failed deliveries up to 5 times
    retries: 5,
    // Timeout per delivery attempt
    timeout: 10_000,
    // Sign payloads with HMAC-SHA256 so subscribers can verify authenticity
    signing: { algorithm: 'sha256', header: 'X-Webhook-Signature' },
  },
});
