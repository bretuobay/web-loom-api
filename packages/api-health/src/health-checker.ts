import type {
  HealthCheckFn,
  HealthCheckOptions,
  HealthCheckerConfig,
  HealthResult,
  CheckDetail,
} from './types';

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_VERSION = '0.0.0';

interface RegisteredCheck {
  name: string;
  fn: HealthCheckFn;
  timeout: number;
}

/**
 * HealthChecker manages health check registrations and executes
 * liveness and readiness probes.
 */
export class HealthChecker {
  private checks: RegisteredCheck[] = [];
  private startTime: number;
  private version: string;
  private defaultTimeout: number;

  constructor() {
    this.startTime = Date.now();
    this.version = DEFAULT_VERSION;
    this.defaultTimeout = DEFAULT_TIMEOUT;
  }

  /**
   * Configure the health checker with version and timeout settings.
   */
  configure(options: HealthCheckerConfig): void {
    if (options.version !== undefined) {
      this.version = options.version;
    }
    if (options.timeout !== undefined) {
      this.defaultTimeout = options.timeout;
    }
  }

  /**
   * Register a named health check function.
   */
  registerCheck(name: string, fn: HealthCheckFn, options?: HealthCheckOptions): void {
    this.checks.push({
      name,
      fn,
      timeout: options?.timeout ?? this.defaultTimeout,
    });
  }


  /**
   * Get uptime in seconds since the HealthChecker was created.
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Run liveness check. Returns healthy if the process is running.
   */
  async runLivenessChecks(): Promise<HealthResult> {
    return {
      status: 'healthy',
      checks: [],
      uptime: this.getUptime(),
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run all registered readiness checks with timeout enforcement.
   * Returns unhealthy if any check fails or times out.
   */
  async runReadinessChecks(): Promise<HealthResult> {
    const checkDetails: CheckDetail[] = [];
    let allHealthy = true;

    for (const check of this.checks) {
      const detail = await this.executeCheck(check);
      checkDetails.push(detail);
      if (detail.status === 'unhealthy') {
        allHealthy = false;
      }
    }

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: checkDetails,
      uptime: this.getUptime(),
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  private async executeCheck(check: RegisteredCheck): Promise<CheckDetail> {
    const start = Date.now();

    try {
      const result = await Promise.race([
        check.fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Check '${check.name}' timed out after ${check.timeout}ms`)), check.timeout)
        ),
      ]);

      return {
        name: check.name,
        status: result.status,
        latency: Date.now() - start,
        message: result.message,
      };
    } catch (error) {
      return {
        name: check.name,
        status: 'unhealthy',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
