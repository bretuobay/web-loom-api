# @web-loom/api-jobs

Background job processing for [Web Loom API](https://github.com/bretuobay/web-loom-api). Priority queues, cron scheduling, exponential backoff retries, and pluggable storage backends (in-memory, Redis).

## Installation

```bash
npm install @web-loom/api-jobs
```

For Redis backend:

```bash
npm install ioredis
```

## Quick Start

```typescript
import { JobQueue, MemoryJobStore } from '@web-loom/api-jobs';
import type { JobHandler } from '@web-loom/api-jobs';

// 1. Define a typed handler
interface WelcomeEmailPayload {
  userId: string;
  email: string;
}

const welcomeEmailHandler: JobHandler<WelcomeEmailPayload> = async (job) => {
  const { userId, email } = job.data;
  await sendEmail({ to: email, subject: 'Welcome!' });
};

// 2. Create queue and register handlers
const queue = new JobQueue({ store: new MemoryJobStore(), concurrency: 2 });
queue.registerHandler('welcome-email', welcomeEmailHandler);

// 3. Start processing
queue.start();

// 4. Enqueue jobs from anywhere in your app
await queue.enqueue({
  name: 'welcome-email',
  data: { userId: '123', email: 'user@example.com' },
});
```

## Enqueue Options

```typescript
await queue.enqueue({
  name: 'send-report',
  data: { reportId: 'abc' },

  // Priority: 'low' | 'normal' | 'high' | 'critical' (default: 'normal')
  priority: 'high',

  // Schedule for the future (Unix ms timestamp)
  scheduledAt: Date.now() + 60_000,

  // Max retry attempts (default: 3)
  maxAttempts: 5,

  // Backoff configuration
  backoff: {
    baseDelay: 1_000, // 1s initial delay
    maxDelay: 30_000, // 30s maximum delay
    multiplier: 2, // exponential growth factor
  },
});
```

## Cron Scheduling

```typescript
queue.scheduleTask({
  name: 'daily-cleanup',
  cron: '0 2 * * *', // every day at 02:00
  handler: async (job) => {
    await db.delete(expiredSessions).where(lt(expiredSessions.expiresAt, new Date()));
  },
  options: { priority: 'low' },
});
```

## Redis Backend

```typescript
import { JobQueue, RedisJobStore } from '@web-loom/api-jobs';
import Redis from 'ioredis';

const queue = new JobQueue({
  store: new RedisJobStore(new Redis(process.env.REDIS_URL!)),
  concurrency: 5,
  pollInterval: 500,
});
```

## `JobQueue` API

```typescript
const queue = new JobQueue(options?);

queue.registerHandler(name, handler)  // Register a job handler
queue.enqueue(options)                // Enqueue a new job → Promise<jobId>
queue.dequeue()                       // Dequeue next ready job
queue.processJob(job)                 // Execute one job manually
queue.scheduleTask(task)              // Register a cron-scheduled task
queue.start()                         // Begin the polling + cron loop
queue.stop()                          // Stop the queue gracefully
```

## `JobQueueOptions`

| Option         | Type       | Default          | Description            |
| -------------- | ---------- | ---------------- | ---------------------- |
| `store`        | `JobStore` | `MemoryJobStore` | Storage backend        |
| `concurrency`  | `number`   | `1`              | Max concurrent jobs    |
| `pollInterval` | `number`   | `1000`           | Polling interval in ms |

## `Job` Shape

```typescript
interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  scheduledAt?: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}
```

## License

MIT
