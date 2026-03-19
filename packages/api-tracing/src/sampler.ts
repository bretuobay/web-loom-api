import {
  SamplingDecision,
  type Sampler,
  type SamplingResult,
  type SpanAttributeValue,
} from './types';

/**
 * Always samples every span.
 */
export class AlwaysSampler implements Sampler {
  shouldSample(): SamplingResult {
    return { decision: SamplingDecision.RECORD_AND_SAMPLE };
  }
}

/**
 * Never samples any span.
 */
export class NeverSampler implements Sampler {
  shouldSample(): SamplingResult {
    return { decision: SamplingDecision.DROP };
  }
}

/**
 * Samples spans based on a probability rate (0.0 to 1.0).
 * Uses the traceId for deterministic sampling so all spans
 * in the same trace get the same decision.
 */
export class ProbabilitySampler implements Sampler {
  private readonly threshold: number;

  constructor(public readonly rate: number) {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
    // Convert rate to a threshold in the 0-0xFFFFFFFF range
    this.threshold = Math.floor(rate * 0xffffffff);
  }

  shouldSample(
    traceId: string,
    _spanName?: string,
    _attributes?: Record<string, SpanAttributeValue>
  ): SamplingResult {
    // Use last 8 hex chars of traceId for deterministic hash
    const hash = parseInt(traceId.slice(-8), 16);
    const decision =
      hash <= this.threshold ? SamplingDecision.RECORD_AND_SAMPLE : SamplingDecision.DROP;
    return { decision };
  }
}

export interface CompositeSamplerOptions {
  /** Base probability for successful requests (0.0 to 1.0). Default: 0.1 */
  baseSampleRate?: number;
  /** Always sample requests slower than this (ms). Default: 1000 */
  slowRequestThresholdMs?: number;
}

/**
 * Composite sampler that:
 * - Always samples errors (attribute 'error' = true)
 * - Always samples slow requests (duration > threshold)
 * - Probability-samples the rest
 */
export class CompositeSampler implements Sampler {
  private readonly probabilitySampler: ProbabilitySampler;
  private readonly slowThresholdMs: number;

  constructor(options: CompositeSamplerOptions = {}) {
    const { baseSampleRate = 0.1, slowRequestThresholdMs = 1000 } = options;
    this.probabilitySampler = new ProbabilitySampler(baseSampleRate);
    this.slowThresholdMs = slowRequestThresholdMs;
  }

  shouldSample(
    traceId: string,
    spanName: string,
    attributes?: Record<string, SpanAttributeValue>
  ): SamplingResult {
    // Always sample errors
    if (attributes?.['error'] === true) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLE,
        attributes: { 'sampling.reason': 'error' },
      };
    }

    // Always sample slow requests
    const duration = attributes?.['duration.ms'];
    if (typeof duration === 'number' && duration > this.slowThresholdMs) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLE,
        attributes: { 'sampling.reason': 'slow_request' },
      };
    }

    // Probability sample the rest
    return this.probabilitySampler.shouldSample(traceId, spanName, attributes);
  }
}
