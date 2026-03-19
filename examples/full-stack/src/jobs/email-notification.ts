/**
 * Full-Stack Example — Email Notification Background Job
 *
 * Demonstrates background job processing. This job is enqueued when a new
 * post is created and sends email notifications to followers.
 */
import { defineJob } from '@web-loom/api-core';
import { User } from '../models/user';
import { Post } from '../models/post';

interface EmailNotificationPayload {
  type: 'new-post';
  postId: string;
  authorName: string;
}

export default defineJob<EmailNotificationPayload>({
  name: 'email-notification',

  // Retry up to 3 times with exponential backoff
  retries: 3,
  backoff: 'exponential',

  handler: async (payload, ctx) => {
    const { postId, authorName } = payload;

    // Fetch the post
    const post = await ctx.db.select(Post).where('id', '=', postId).first();
    if (!post) {
      ctx.logger.warn(`Post ${postId} not found, skipping notification`);
      return;
    }

    // In a real app, you'd query a followers/subscribers table.
    // For this example, we notify all users.
    const users = await ctx.db.select(User).limit(100);

    // Send emails in batches
    const emails = users
      .filter((u) => u.id !== post.userId) // Don't notify the author
      .map((u) => ({
        from: 'noreply@example.com',
        to: u.email,
        subject: `New post by ${authorName}: ${post.title}`,
        html: `
          <h2>${post.title}</h2>
          <p>${post.content.slice(0, 200)}...</p>
          <a href="${process.env.FRONTEND_URL}/posts/${post.slug}">Read more</a>
        `,
      }));

    if (emails.length > 0) {
      await ctx.email.sendBatch(emails);
      ctx.logger.info(`Sent ${emails.length} notifications for post ${postId}`);
    }
  },
});
