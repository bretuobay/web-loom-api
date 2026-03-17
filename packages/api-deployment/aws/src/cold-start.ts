// Cold start optimization utilities for AWS Lambda
// Tracks cold start timing and provides warmup mechanisms

import type { LambdaEvent, LambdaHandler } from './types';

/**
 * Tracks and optimizes Lambda cold start performance.
 *
 * Cold starts occur when Lambda creates a new execution environment.
 * This class helps measure cold start duration and provides warmup
 * mechanisms to keep functions warm.
 */
export class ColdStartOptimizer {
  private coldStartTime: number | null = null;
  private coldStartDuration: number | null = null;
  private initialized = false;
  private warmupEventField: string;

  constructor(warmupEventField = 'source') {
    this.coldStartTime = Date.now();
    this.warmupEventField = warmupEventField;
  }

  /**
   * Record that the cold start phase has completed.
   * Call this after handler initialization is done.
   */
  trackColdStart(): void {
    if (!this.initialized && this.coldStartTime !== null) {
      this.coldStartDuration = Date.now() - this.coldStartTime;
      this.initialized = true;
    }
  }

  /**
   * Check if this is a cold start invocation (first invocation in this environment)
   */
  isColdStart(): boolean {
    return !this.initialized;
  }

  /**
   * Get the cold start duration in milliseconds, or null if not yet tracked
   */
  getColdStartDuration(): number | null {
    return this.coldStartDuration;
  }

  /**
   * Check if an event is a scheduled warmup/keep-alive event.
   * Warmup events are typically sent by CloudWatch Events/EventBridge
   * to prevent cold starts.
   */
  isWarmupEvent(event: LambdaEvent, warmupValue = 'serverless-plugin-warmup'): boolean {
    if (!event || typeof event !== 'object') return false;

    // Check for the configured warmup field
    const record = event as unknown as Record<string, unknown>;
    if (record[this.warmupEventField] === warmupValue) {
      return true;
    }

    // Also check common warmup patterns
    if (record['detail-type'] === 'Scheduled Event') {
      return true;
    }

    return false;
  }

  /**
   * Wrap a handler with warmup detection and cold start tracking.
   * If a warmup event is detected, returns early with a 200 response.
   * Otherwise, tracks cold start timing and delegates to the real handler.
   */
  warmup(handler: LambdaHandler, warmupValue?: string): LambdaHandler {
    return async (event, context) => {
      // Handle warmup events with minimal processing
      if (this.isWarmupEvent(event, warmupValue)) {
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Warmup successful' }),
        };
      }

      // Track cold start on first real invocation
      this.trackColdStart();

      return handler(event, context);
    };
  }
}
