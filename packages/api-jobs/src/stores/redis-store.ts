/**
 * Redis Job Store (Interface + Stub)
 *
 * Defines the contract for a Redis-backed job store suitable for
 * distributed / production deployments. Provides a mock implementation
 * backed by in-memory Maps for testing.
 */

import type { Job, JobStatus, JobStore } from '../types';
import { PRIORITY_VALUES } from '../types';

/**
 * Minimal Redis client interface.
 * Any Redis library exposing these methods can be used.
 */
export interface RedisJobClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string | string[]): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export interface RedisJobStoreOptions {
  /** Redis client instance */
  client: RedisJobClient;
  /** Optional key prefix. Default: 'jobs:' */
  keyPrefix?: string | undefined;
}

export class RedisJobStore implements JobStore {
  private readonly client: RedisJobClient;
  private readonly prefix: string;

  constructor(options: RedisJobStoreOptions) {
    this.client = options.client;
    this.prefix = options.keyPrefix ?? 'jobs:';
  }

  private jobKey(id: string): string {
    return `${this.prefix}${id}`;
  }

  private deadKey(id: string): string {
    return `${this.prefix}dead:${id}`;
  }

  async save(job: Job): Promise<void> {
    await this.client.set(this.jobKey(job.id), JSON.stringify(job));
  }

  async get(id: string): Promise<Job | undefined> {
    const raw = await this.client.get(this.jobKey(id));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as Job;
    } catch {
      return undefined;
    }
  }

  async dequeue(): Promise<Job | undefined> {
    const keys = await this.client.keys(`${this.prefix}*`);
    const now = Date.now();
    const candidates: Job[] = [];

    for (const key of keys) {
      if (key.includes('dead:')) continue;
      const raw = await this.client.get(key);
      if (!raw) continue;
      try {
        const job = JSON.parse(raw) as Job;
        if (job.status !== 'pending' && job.status !== 'retrying') continue;
        if (job.scheduledAt !== undefined && job.scheduledAt > now) continue;
        candidates.push(job);
      } catch {
        // skip malformed entries
      }
    }

    if (candidates.length === 0) return undefined;

    candidates.sort((a, b) => {
      const pDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
      if (pDiff !== 0) return pDiff;
      return a.createdAt - b.createdAt;
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const selected = candidates[0]!;
    selected.status = 'processing';
    selected.updatedAt = now;
    await this.save(selected);

    return { ...selected };
  }

  async getByStatus(status: JobStatus): Promise<Job[]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    const result: Job[] = [];

    for (const key of keys) {
      if (key.includes('dead:')) continue;
      const raw = await this.client.get(key);
      if (!raw) continue;
      try {
        const job = JSON.parse(raw) as Job;
        if (job.status === status) result.push(job);
      } catch {
        // skip
      }
    }

    return result;
  }

  async moveToDead(job: Job): Promise<void> {
    await this.client.del(this.jobKey(job.id));
    await this.client.set(this.deadKey(job.id), JSON.stringify(job));
  }

  async getDeadLetterJobs(): Promise<Job[]> {
    const keys = await this.client.keys(`${this.prefix}dead:*`);
    const result: Job[] = [];

    for (const key of keys) {
      const raw = await this.client.get(key);
      if (!raw) continue;
      try {
        result.push(JSON.parse(raw) as Job);
      } catch {
        // skip
      }
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    await this.client.del(this.jobKey(id));
    await this.client.del(this.deadKey(id));
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  /**
   * Create a mock Redis job store backed by in-memory Maps.
   * Useful for testing without a real Redis connection.
   */
  static createMock(): RedisJobStore {
    const data = new Map<string, string>();

    const mockClient: RedisJobClient = {
      async get(key: string): Promise<string | null> {
        return data.get(key) ?? null;
      },
      async set(key: string, value: string): Promise<string> {
        data.set(key, value);
        return 'OK';
      },
      async del(key: string | string[]): Promise<number> {
        const keys = Array.isArray(key) ? key : [key];
        let count = 0;
        for (const k of keys) {
          if (data.delete(k)) count++;
        }
        return count;
      },
      async keys(pattern: string): Promise<string[]> {
        const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
        const result: string[] = [];
        data.forEach((_value, k) => {
          if (k.startsWith(prefix)) result.push(k);
        });
        return result;
      },
    };

    return new RedisJobStore({ client: mockClient });
  }
}
