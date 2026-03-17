/**
 * Vercel Edge Runtime support for Web Loom API Framework
 */
import type { VercelEdgeConfig, VercelHandlerOptions, VercelRuntime } from './types';

/** Default edge-compatible regions */
const DEFAULT_EDGE_REGIONS = ['iad1', 'sfo1', 'cdg1', 'hnd1'] as const;

/**
 * Detect the current runtime environment.
 * Checks options first, then falls back to environment detection.
 */
export function detectRuntime(options?: VercelHandlerOptions): VercelRuntime {
  if (options?.runtime) {
    return options.runtime;
  }

  // Edge runtime sets this global
  if (typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis) {
    return 'edge';
  }

  return 'nodejs';
}

/**
 * Check if the current environment is an edge runtime.
 */
export function isEdgeRuntime(options?: VercelHandlerOptions): boolean {
  return detectRuntime(options) === 'edge';
}

/**
 * Create the Vercel edge config export object.
 * Use this to export `config` from your API route for edge deployment.
 *
 * @example
 * ```ts
 * export const config = createEdgeConfig({ regions: ['iad1'] });
 * ```
 */
export function createEdgeConfig(options?: { regions?: string[] }): VercelEdgeConfig {
  return {
    runtime: 'edge',
    regions: options?.regions,
  };
}

/**
 * Get optimal deployment regions based on configuration.
 * Returns recommended Vercel regions for edge deployment.
 */
export function getOptimalRegions(config?: {
  primaryRegions?: string[];
  autoDetect?: boolean;
  maxRegions?: number;
}): string[] {
  const { primaryRegions, autoDetect = true, maxRegions = 4 } = config ?? {};

  // If explicit regions provided, use them (capped by maxRegions)
  if (primaryRegions && primaryRegions.length > 0) {
    return primaryRegions.slice(0, maxRegions);
  }

  // Auto-detect: return default global distribution
  if (autoDetect) {
    return [...DEFAULT_EDGE_REGIONS].slice(0, maxRegions);
  }

  // Fallback to US East
  return ['iad1'];
}
