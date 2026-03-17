/**
 * In-Memory Job Store
 *
 * Simple Map-based storage backend suitable for single-process / development use.
 * Jobs are stored in memory and lost on process restart.
 */

import type { Job, JobStatus, JobStore } from '../types';
import { PRIORITY_VALUES } from '../types';

export class MemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly deadLetter = new Map<string, Job>();

  async save(job: Job): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async get(id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }

  async dequeue(): Promise<Job | undefined> {
    const now = Date.now();
    const candidates: Job[] = [];

    this.jobs.forEach((job) => {
      if (job.status !== 'pending' && job.status !== 'retrying') return;
      if (job.scheduledAt !== undefined && job.scheduledAt > now) return;
      candidates.push(job);
    });

    if (candidates.length === 0) return undefined;

    // Sort by priority desc, then createdAt asc
    candidates.sort((a, b) => {
      const pDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
      if (pDiff !== 0) return pDiff;
      return a.createdAt - b.createdAt;
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const selected = candidates[0]!;
    selected.status = 'processing';
    selected.updatedAt = now;
    this.jobs.set(selected.id, selected);

    return { ...selected };
  }

  async getByStatus(status: JobStatus): Promise<Job[]> {
    const result: Job[] = [];
    this.jobs.forEach((job) => {
      if (job.status === status) {
        result.push({ ...job });
      }
    });
    return result;
  }

  async moveToDead(job: Job): Promise<void> {
    this.jobs.delete(job.id);
    this.deadLetter.set(job.id, { ...job });
  }

  async getDeadLetterJobs(): Promise<Job[]> {
    const result: Job[] = [];
    this.deadLetter.forEach((job) => {
      result.push({ ...job });
    });
    return result;
  }

  async delete(id: string): Promise<void> {
    this.jobs.delete(id);
    this.deadLetter.delete(id);
  }

  async clear(): Promise<void> {
    this.jobs.clear();
    this.deadLetter.clear();
  }

  /** Number of active jobs (useful for testing) */
  get size(): number {
    return this.jobs.size;
  }

  /** Number of dead-letter jobs (useful for testing) */
  get deadLetterSize(): number {
    return this.deadLetter.size;
  }
}
