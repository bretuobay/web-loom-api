import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryJobStore } from '../stores/memory-store';
import { RedisJobStore } from '../stores/redis-store';
import type { Job, JobStore } from '../types';

function createTestJob(overrides: Partial<Job> = {}): Job {
  const now = Date.now();
  return {
    id: `test_${Math.random().toString(36).slice(2, 8)}`,
    name: 'test-job',
    data: { value: 1 },
    priority: 'normal',
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    backoff: { baseDelay: 1000, maxDelay: 30_000, multiplier: 2 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function runStoreTests(name: string, createStore: () => JobStore) {
  describe(name, () => {
    let store: JobStore;

    beforeEach(async () => {
      store = createStore();
      await store.clear();
    });

    it('saves and retrieves a job', async () => {
      const job = createTestJob();
      await store.save(job);
      const retrieved = await store.get(job.id);
      expect(retrieved).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(retrieved!.id).toBe(job.id);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(retrieved!.name).toBe(job.name);
    });

    it('returns undefined for non-existent job', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('dequeues highest priority job first', async () => {
      const low = createTestJob({ id: 'low', priority: 'low', createdAt: 1 });
      const high = createTestJob({ id: 'high', priority: 'high', createdAt: 2 });
      await store.save(low);
      await store.save(high);

      const dequeued = await store.dequeue();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(dequeued!.id).toBe('high');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(dequeued!.status).toBe('processing');
    });

    it('dequeues by createdAt when priority is equal', async () => {
      const older = createTestJob({ id: 'older', createdAt: 1000 });
      const newer = createTestJob({ id: 'newer', createdAt: 2000 });
      await store.save(newer);
      await store.save(older);

      const dequeued = await store.dequeue();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(dequeued!.id).toBe('older');
    });

    it('skips jobs not ready for processing', async () => {
      const future = createTestJob({ scheduledAt: Date.now() + 60_000 });
      const completed = createTestJob({ id: 'done', status: 'completed' });
      await store.save(future);
      await store.save(completed);

      const dequeued = await store.dequeue();
      expect(dequeued).toBeUndefined();
    });

    it('gets jobs by status', async () => {
      const pending = createTestJob({ id: 'p1' });
      const completed = createTestJob({ id: 'c1', status: 'completed' });
      await store.save(pending);
      await store.save(completed);

      const pendingJobs = await store.getByStatus('pending');
      expect(pendingJobs).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(pendingJobs[0]!.id).toBe('p1');
    });

    it('moves job to dead letter', async () => {
      const job = createTestJob({ status: 'failed' });
      await store.save(job);
      await store.moveToDead(job);

      const main = await store.get(job.id);
      expect(main).toBeUndefined();

      const dead = await store.getDeadLetterJobs();
      expect(dead).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(dead[0]!.id).toBe(job.id);
    });

    it('deletes a job', async () => {
      const job = createTestJob();
      await store.save(job);
      await store.delete(job.id);
      const result = await store.get(job.id);
      expect(result).toBeUndefined();
    });

    it('clears all jobs', async () => {
      await store.save(createTestJob({ id: 'a' }));
      await store.save(createTestJob({ id: 'b' }));
      await store.clear();

      const a = await store.get('a');
      const b = await store.get('b');
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
    });
  });
}

runStoreTests('MemoryJobStore', () => new MemoryJobStore());
runStoreTests('RedisJobStore (mock)', () => RedisJobStore.createMock());
