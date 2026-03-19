import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobQueue, calculateBackoff } from '../job-queue';
import { MemoryJobStore } from '../stores/memory-store';
import type { ResolvedBackoffOptions } from '../types';

describe('calculateBackoff', () => {
  const opts: ResolvedBackoffOptions = { baseDelay: 1000, maxDelay: 30_000, multiplier: 2 };

  it('returns baseDelay for first attempt', () => {
    expect(calculateBackoff(1, opts)).toBe(1000);
  });

  it('doubles delay for second attempt', () => {
    expect(calculateBackoff(2, opts)).toBe(2000);
  });

  it('caps at maxDelay', () => {
    expect(calculateBackoff(100, opts)).toBe(30_000);
  });
});

describe('JobQueue', () => {
  let store: MemoryJobStore;
  let queue: JobQueue;

  beforeEach(() => {
    store = new MemoryJobStore();
    queue = new JobQueue({ store, pollInterval: 50 });
  });

  it('enqueues a job and returns an id', async () => {
    const id = await queue.enqueue({ name: 'test', data: { foo: 1 } });
    expect(id).toBeTruthy();
    const job = await queue.getJob(id);
    expect(job).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(job!.name).toBe('test');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(job!.status).toBe('pending');
  });

  it('dequeues jobs by priority (higher first)', async () => {
    await queue.enqueue({ name: 'low', data: {}, priority: 'low' });
    await queue.enqueue({ name: 'critical', data: {}, priority: 'critical' });
    await queue.enqueue({ name: 'normal', data: {}, priority: 'normal' });

    const first = await queue.dequeue();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(first!.name).toBe('critical');
    const second = await queue.dequeue();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(second!.name).toBe('normal');
    const third = await queue.dequeue();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(third!.name).toBe('low');
  });

  it('processes a job successfully', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.registerHandler('work', handler);

    const id = await queue.enqueue({ name: 'work', data: { x: 42 } });
    const job = await queue.dequeue();
    expect(job).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await queue.processJob(job!);

    const updated = await queue.getJob(id);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.status).toBe('completed');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.completedAt).toBeDefined();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('retries a failed job with exponential backoff', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    queue.registerHandler('fail', handler);

    const id = await queue.enqueue({
      name: 'fail',
      data: {},
      maxAttempts: 3,
      backoff: { baseDelay: 100 },
    });

    const job = await queue.dequeue();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await queue.processJob(job!);

    const updated = await queue.getJob(id);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.status).toBe('retrying');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.attempts).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.lastError).toBe('boom');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.scheduledAt).toBeDefined();
  });

  it('moves job to dead letter after max attempts', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('permanent fail'));
    queue.registerHandler('dead', handler);

    const id = await queue.enqueue({
      name: 'dead',
      data: {},
      maxAttempts: 1,
    });

    const job = await queue.dequeue();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await queue.processJob(job!);

    // Job should be in dead letter, not in main store
    const mainJob = await queue.getJob(id);
    expect(mainJob).toBeUndefined();

    const deadJobs = await queue.getDeadLetterJobs();
    expect(deadJobs).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(deadJobs[0]!.status).toBe('failed');
  });

  it('fails job when no handler is registered', async () => {
    const id = await queue.enqueue({ name: 'unknown', data: {} });
    const job = await queue.dequeue();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await queue.processJob(job!);

    const updated = await queue.getJob(id);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.status).toBe('failed');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updated!.lastError).toContain('No handler registered');
  });

  it('respects scheduledAt for delayed jobs', async () => {
    await queue.enqueue({
      name: 'delayed',
      data: {},
      scheduledAt: Date.now() + 60_000, // 1 minute in the future
    });

    const job = await queue.dequeue();
    expect(job).toBeUndefined(); // Not ready yet
  });

  it('starts and stops the processing loop', () => {
    expect(queue.isRunning).toBe(false);
    queue.start();
    expect(queue.isRunning).toBe(true);
    queue.stop();
    expect(queue.isRunning).toBe(false);
  });

  it('schedules a cron task', () => {
    expect(() => {
      queue.schedule({
        name: 'cleanup',
        cron: '0 2 * * *',
        handler: async () => {},
      });
    }).not.toThrow();
  });
});
