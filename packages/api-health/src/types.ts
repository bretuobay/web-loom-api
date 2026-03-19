/**
 * Status of an individual health check or overall health.
 */
export type HealthStatus = 'healthy' | 'unhealthy';

/**
 * Result returned by an individual health check function.
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
}

/**
 * Result of a single named check including latency measurement.
 */
export interface CheckDetail {
  name: string;
  status: HealthStatus;
  latency: number;
  message?: string;
}

/**
 * Overall health result returned by liveness and readiness endpoints.
 */
export interface HealthResult {
  status: HealthStatus;
  checks: CheckDetail[];
  uptime: number;
  version: string;
  timestamp: string;
}

/**
 * A health check function that returns a promise with status and optional message.
 */
export type HealthCheckFn = () => Promise<HealthCheckResult>;

/**
 * Options for registering a health check.
 */
export interface HealthCheckOptions {
  /** Timeout in milliseconds for this check. Overrides the global timeout. */
  timeout?: number;
}

/**
 * Configuration options for the HealthChecker.
 */
export interface HealthCheckerConfig {
  /** Application version string. */
  version?: string;
  /** Default timeout in milliseconds for each check. Defaults to 5000. */
  timeout?: number;
}
