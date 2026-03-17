/**
 * Background Jobs Types
 *
 * Type definitions for job queue, scheduling, storage backends,
 * and configuration options.
 */

// -----------------------------------------------------------------------
// Job Status
// -----------------------------------------------------------------------

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying';

// -----------------------------------------------------------------------
// Job Priority
// -----------------------------------------------------------------------

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

/** Numeric mapping for priority comparison (higher = processed first) */
export const PRIORITY_VALUES: Record<JobPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

// -----------------------------------------------------------------------
// Backoff Strategy
// -----------------------------------------------------------------------

export interface BackoffOptions {
  /** Base delay in milliseconds. Default: 1000 */
  baseDelay?: number | undefined;
  /** Maximum delay in milliseconds. Default: 30_000 */
  maxDelay?: number | undefined;
  /** Multiplier for exponential growth. Default: 2 */
  multiplier?: number | undefined;
}

export interface ResolvedBackoffOptions {
  baseDelay: number;
  maxDelay: number;
  multiplier: number;
}

// -----------------------------------------------------------------------
// Job Definition
// -----------------------------------------------------------------------

export interface Job<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Job name / type identifier */
  name: string;
  /** Arbitrary payload data */
  data: T;
  /** Job priority */
  priority: JobPriority;
  /** Current status */
  status: JobStatus;
  /** When the job should be executed (undefined = immediately) */
  scheduledAt?: number | undefined;
  /** Number of attempts made so far */
  attempts: number;
  /** Maximum number of attempts before moving to dead letter */
  maxAttempts: number;
  /** Backoff configuration for retries */
  backoff: ResolvedBackoffOptions;
  /** Timestamp when the job was created */
  createdAt: number;
  /** Timestamp when the job was last updated */
  updatedAt: number;
  /** Timestamp when the job completed (or failed permanently) */
  completedAt?: number | undefined;
  /** Error message from the last failed attempt */
  lastError?: string | undefined;
}

// -----------------------------------------------------------------------
// Job Handler
// -----------------------------------------------------------------------

/** Function that executes a job's work */
export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

// -----------------------------------------------------------------------
// Enqueue Options
// -----------------------------------------------------------------------

export interface EnqueueOptions<T = unknown> {
  /** Job name / type */
  name: string;
  /** Payload data */
  data: T;
  /** Priority level. Default: 'normal' */
  priority?: JobPriority | undefined;
  /** Delay execution until this timestamp (ms since epoch) */
  scheduledAt?: number | undefined;
  /** Maximum retry attempts. Default: 3 */
  maxAttempts?: number | undefined;
  /** Backoff configuration */
  backoff?: BackoffOptions | undefined;
}

// -----------------------------------------------------------------------
// Job Store
// -----------------------------------------------------------------------

/**
 * Storage backend interface for job persistence.
 */
export interface JobStore {
  /** Save a job (insert or update) */
  save(job: Job): Promise<void>;

  /** Get a job by ID */
  get(id: string): Promise<Job | undefined>;

  /**
   * Fetch the next job ready for processing, ordered by priority (desc)
   * then createdAt (asc). Only returns jobs with status 'pending' or
   * 'retrying' whose scheduledAt is less than or equal to now.
   * Atomically sets the returned job's status to 'processing'.
   */
  dequeue(): Promise<Job | undefined>;

  /** Get all jobs matching a given status */
  getByStatus(status: JobStatus): Promise<Job[]>;

  /** Move a job to the dead letter queue */
  moveToDead(job: Job): Promise<void>;

  /** Get all dead-letter jobs */
  getDeadLetterJobs(): Promise<Job[]>;

  /** Delete a job by ID */
  delete(id: string): Promise<void>;

  /** Clear all jobs (useful for testing) */
  clear(): Promise<void>;
}

// -----------------------------------------------------------------------
// Cron Schedule
// -----------------------------------------------------------------------

export interface ScheduledTask {
  /** Unique name for the scheduled task */
  name: string;
  // Cron expression, e.g. "0/5 * * * *" for every 5 minutes
  cron: string;
  /** Job handler to execute */
  handler: JobHandler;
  /** Job options (priority, maxAttempts, etc.) */
  options?: Partial<Pick<EnqueueOptions, 'priority' | 'maxAttempts' | 'backoff'>> | undefined;
}

// -----------------------------------------------------------------------
// Job Queue Options
// -----------------------------------------------------------------------

export interface JobQueueOptions {
  /** Storage backend. Default: in-memory store */
  store?: JobStore | undefined;
  /** Polling interval in ms for processing loop. Default: 1000 */
  pollInterval?: number | undefined;
  /** Maximum concurrent jobs being processed. Default: 1 */
  concurrency?: number | undefined;
}
