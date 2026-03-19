/**
 * @web-loom/api-jobs
 *
 * Background job processing for Web Loom API Framework.
 * Provides a job queue with priority support, cron scheduling,
 * retry logic with exponential backoff, and pluggable storage backends.
 */

export { JobQueue, calculateBackoff } from './job-queue';
export { parseCron, cronMatches, getNextCronDate } from './cron';
export type { ParsedCron } from './cron';
export { MemoryJobStore } from './stores/memory-store';
export { RedisJobStore } from './stores/redis-store';
export type { RedisJobClient, RedisJobStoreOptions } from './stores/redis-store';
export type {
  Job,
  JobStatus,
  JobPriority,
  JobHandler,
  JobStore,
  EnqueueOptions,
  BackoffOptions,
  ResolvedBackoffOptions,
  ScheduledTask,
  JobQueueOptions,
} from './types';
export { PRIORITY_VALUES } from './types';
