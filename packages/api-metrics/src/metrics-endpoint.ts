import { MetricsRegistry } from './metrics-registry';
import type { MetricsEndpointResponse } from './types';

/** Prometheus content type header value. */
export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/**
 * Handle a /metrics endpoint request.
 * Returns a response object with Prometheus-formatted metrics.
 */
export function handleMetricsRequest(registry?: MetricsRegistry): MetricsEndpointResponse {
  const reg = registry ?? MetricsRegistry.getInstance();
  const body = reg.serialize();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': METRICS_CONTENT_TYPE,
    },
    body,
  };
}
