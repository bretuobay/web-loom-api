/**
 * Job Queue
 *
 * Core job queue implementation with priority support, cron scheduling,
 * retry logic with exponential backoff, and pluggable storage backends.
 */

import { parseCron, cronMatches } from './cron';
import { MemoryJobStore } from './stores/memory-store';
import type {
  Job,
  JobHandler,
  EnqueueOptions,
  JobQueueOptions,
  JobStore,
  ResolvedBackoffOptions,
  ScheduledTask,
} from './types';

const DEFAULT_BACKOFF: ResolvedBackoffOptions = {
  baseDelay: 1000,
  maxDelay: 30_000,
  multiplier: 2,
};

let idCounter = 0;

function generateId(): string {
  idCounter++;
  return `job_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Calculate the next retry delay using exponential backoff.
 */
export function calculateBackoff(attempt: number, options: ResolvedBackoffOptions): number {
  const delay = options.baseDelay * Math.pow(options.multiplier, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

export class JobQueue {
  private readonly store: JobStore;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly scheduledTasks: Array<{
    task: ScheduledTask;
    parsed: ReturnType<typeof parseCron>;
  }> = [];

  private readonly pollInterval: number;
  private readonly concurrency: number;
  private activeCount = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cronTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(options: JobQueueOptions = {}) {
    this.store = options.store ?? new MemoryJobStore();
    this.pollInterval = options.pollInterval ?? 1000;
    this.concurrency = options.concurrency ?? 1;
  }

  /** Register a handler for a job name */
  registerHandler<T = unknown>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler);
  }

  /**
   * Enqueue a new job.
   * Returns the assigned job ID.
   */
  async enqueue<T = unknown>(options: EnqueueOptions<T>): Promise<string> {
    const backoff: ResolvedBackoffOptions = {
      baseDelay: options.backoff?.baseDelay ?? DEFAULT_BACKOFF.baseDelay,
      maxDelay: options.backoff?.maxDelay ?? DEFAULT_BACKOFF.maxDelay,
      multiplier: options.backoff?.multiplier ?? DEFAULT_BACKOFF.multiplier,
    };

    const now = Date.now();
    const job: Job = {
      id: generateId(),
      name: options.name,
      data: options.data,
      priority: options.priority ?? 'normal',
      status: 'pending',
      scheduledAt: options.scheduledAt,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      backoff,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.save(job);
    return job.id;
  }

  /**
   * Dequeue the next job ready for processing.
   * Returns undefined if no jobs are available.
   */
  async dequeue(): Promise<Job | undefined> {
    return this.store.dequeue();
  }

  /**
   * Process a single job: execute its handler and update status.
   */
  async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.name);
    if (!handler) {
      job.status = 'failed';
      job.lastError = `No handler registered for job "${job.name}"`;
      job.updatedAt = Date.now();
      await this.store.save(job);
      return;
    }

    job.attempts++;
    job.updatedAt = Date.now();
    await this.store.save(job);

    try {
      await handler(job);
      job.status = 'completed';
      job.completedAt = Date.now();
      job.updatedAt = Date.now();
      await this.store.save(job);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      job.lastError = errorMessage;
      job.updatedAt = Date.now();

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        job.completedAt = Date.now();
        await this.store.moveToDead(job);
      } else {
        job.status = 'retrying';
        const delay = calculateBackoff(job.attempts, job.backoff);
        job.scheduledAt = Date.now() + delay;
        await this.store.save(job);
      }
    }
  }

  /**
   * Register a cron-scheduled task.
   * The task will be enqueued automatically when its cron expression matches.
   */
  schedule(task: ScheduledTask): void {
    const parsed = parseCron(task.cron);
    this.scheduledTasks.push({ task, parsed });
    // Register the handler
    this.registerHandler(task.name, task.handler);
  }

  /**
   * Check all scheduled tasks and enqueue any that match the current time.
   */
  async checkSchedules(): Promise<void> {
    const now = new Date();
    for (const { task, parsed } of this.scheduledTasks) {
      if (cronMatches(parsed, now)) {
        await this.enqueue({
          name: task.name,
          data: { scheduledAt: now.toISOString() },
          priority: task.options?.priority ?? 'normal',
          maxAttempts: task.options?.maxAttempts ?? 3,
          backoff: task.options?.backoff,
        });
      }
    }
  }

  /** Get a job by ID */
  async getJob(id: string): Promise<Job | undefined> {
    return this.store.get(id);
  }

  /** Get all dead-letter jobs */
  async getDeadLetterJobs(): Promise<Job[]> {
    return this.store.getDeadLetterJobs();
  }

  /**
   * Start the processing loop.
   * Polls the store for available jobs and processes them.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollInterval);

    // Check cron schedules every 60 seconds
    this.cronTimer = setInterval(() => {
      void this.checkSchedules();
    }, 60_000);

    // Unref timers so they don't keep the process alive
    if (typeof this.pollTimer === 'object' && 'unref' in this.pollTimer) {
      this.pollTimer.unref();
    }
    if (typeof this.cronTimer === 'object' && 'unref' in this.cronTimer) {
      this.cronTimer.unref();
    }
  }

  /** Stop the processing loop */
  stop(): void {
    this.running = false;
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.cronTimer !== null) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }

  /** Whether the queue is currently running */
  get isRunning(): boolean {
    return this.running;
  }

  private async poll(): Promise<void> {
    while (this.running && this.activeCount < this.concurrency) {
      const job = await this.dequeue();
      if (!job) break;

      this.activeCount++;
      this.processJob(job)
        .catch(() => {
          // Error already handled in processJob
        })
        .finally(() => {
          this.activeCount--;
        });
    }
  }
}
