/**
 * Full-Stack Example — Email Notification Background Job
 *
 * Uses JobQueue from @web-loom/api-jobs directly. Register handlers via
 * queue.register(name, handler), then enqueue jobs from route handlers via
 * jobQueue.enqueue({ name, data }).
 *
 * Note: `defineJob` does not exist — use JobQueue + JobHandler instead.
 */
import { JobQueue, MemoryJobStore } from '@web-loom/api-jobs';
import type { JobHandler } from '@web-loom/api-jobs';

interface EmailNotificationPayload {
  type: 'new-post';
  postId: string;
  authorName: string;
}

const emailNotificationHandler: JobHandler<EmailNotificationPayload> = async (job) => {
  const { postId, authorName } = job.data;

  // In production: query a followers table and send via your email provider.
  // c.var.db isn't available here — use a standalone db client or pass it in
  // via closure when the app starts.
  console.info(`Sending notifications for post ${postId} by ${authorName}`);

  // Example: send via Resend, Nodemailer, or any HTTP email API
  // await fetch('https://api.resend.com/emails', { method: 'POST', ... });
};

export const jobQueue = new JobQueue({
  store: new MemoryJobStore(),
  concurrency: 2,
});

jobQueue.registerHandler('email-notification', emailNotificationHandler);

// Start the queue processing loop when this module is imported
jobQueue.start();
