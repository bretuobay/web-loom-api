import type { HealthCheckFn, HealthCheckResult } from './types';
import { HealthChecker } from './health-checker';

/**
 * Handle a liveness probe request.
 * Returns { statusCode: 200, body: HealthResult }.
 */
export async function handleLivenessRequest(checker: HealthChecker) {
  const result = await checker.runLivenessChecks();
  return { statusCode: 200, body: result };
}

/**
 * Handle a readiness probe request.
 * Returns 200 if all checks pass, 503 if any fail.
 */
export async function handleReadinessRequest(checker: HealthChecker) {
  const result = await checker.runReadinessChecks();
  const statusCode = result.status === 'healthy' ? 200 : 503;
  return { statusCode, body: result };
}

/**
 * Create a database connectivity health check.
 * Wraps a ping function that tests database connectivity.
 */
export function createDatabaseCheck(pingFn: () => Promise<void>): HealthCheckFn {
  return async (): Promise<HealthCheckResult> => {
    try {
      await pingFn();
      return { status: 'healthy', message: 'Database connection OK' };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  };
}

/**
 * Create an adapter initialization health check.
 */
export function createAdapterCheck(name: string, checkFn: () => Promise<boolean>): HealthCheckFn {
  return async (): Promise<HealthCheckResult> => {
    try {
      const initialized = await checkFn();
      return initialized
        ? { status: 'healthy', message: `${name} adapter initialized` }
        : { status: 'unhealthy', message: `${name} adapter not initialized` };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : `${name} adapter check failed`,
      };
    }
  };
}

/**
 * Create a generic custom health check.
 */
export function createCustomCheck(
  name: string,
  fn: () => Promise<HealthCheckResult>
): HealthCheckFn {
  return async (): Promise<HealthCheckResult> => {
    try {
      return await fn();
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : `${name} check failed`,
      };
    }
  };
}
