// CloudWatch Logs integration for Lambda functions
// Outputs structured JSON logs compatible with CloudWatch Logs Insights

import type { CloudWatchLogEntry, LambdaContext } from './types';

/**
 * Structured logger that outputs CloudWatch-compatible JSON to stdout.
 *
 * CloudWatch Logs automatically captures stdout/stderr from Lambda functions.
 * This logger formats entries as JSON for easy querying with CloudWatch
 * Logs Insights.
 */
export class CloudWatchLogger {
  private requestId: string | undefined;
  private traceId: string | undefined;
  private defaultContext: Record<string, unknown>;

  constructor(defaultContext: Record<string, unknown> = {}) {
    this.defaultContext = defaultContext;
  }

  /**
   * Set the Lambda context for request correlation.
   * Call this at the start of each invocation.
   */
  setLambdaContext(lambdaContext: LambdaContext): void {
    this.requestId = lambdaContext.awsRequestId;
    // X-Ray trace ID is available via environment variable
    this.traceId = process.env._X_AMZN_TRACE_ID || undefined;
  }

  /**
   * Log a message at the specified level with optional context
   */
  log(
    level: CloudWatchLogEntry['level'],
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry = formatForCloudWatch({
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      traceId: this.traceId,
      context: { ...this.defaultContext, ...context },
    });

    // CloudWatch captures stdout as log entries
    process.stdout.write(entry + '\n');
  }

  /** Log at DEBUG level */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('DEBUG', message, context);
  }

  /** Log at INFO level */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('INFO', message, context);
  }

  /** Log at WARN level */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('WARN', message, context);
  }

  /** Log at ERROR level */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('ERROR', message, context);
  }

  /**
   * Clear the Lambda context (call between invocations if needed)
   */
  clearContext(): void {
    this.requestId = undefined;
    this.traceId = undefined;
  }
}

/**
 * Format a log entry as a CloudWatch-compatible JSON string.
 * The output is a single-line JSON object that CloudWatch Logs Insights
 * can parse and query.
 */
export function formatForCloudWatch(entry: CloudWatchLogEntry): string {
  const logObject: Record<string, unknown> = {
    level: entry.level,
    message: entry.message,
    timestamp: entry.timestamp,
  };

  if (entry.requestId) {
    logObject.requestId = entry.requestId;
  }

  if (entry.traceId) {
    logObject.traceId = entry.traceId;
  }

  if (entry.context && Object.keys(entry.context).length > 0) {
    logObject.context = entry.context;
  }

  return JSON.stringify(logObject);
}
