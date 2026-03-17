import type { TraceContext } from './types';

const TRACEPARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

/**
 * Parse a W3C traceparent header into a TraceContext.
 * Format: version-traceId-spanId-traceFlags
 * Example: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
 */
export function parseTraceparent(header: string): TraceContext | null {
  const trimmed = header.trim();
  const match = trimmed.match(TRACEPARENT_REGEX);
  if (!match) return null;

  const version = match[1];
  const traceId = match[2];
  const spanId = match[3];
  const flags = match[4];
  if (!version || !traceId || !spanId || !flags) return null;

  // Version "ff" is invalid per spec
  if (version === 'ff') return null;

  // All-zero traceId or spanId is invalid
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;

  return {
    traceId,
    spanId,
    traceFlags: parseInt(flags, 16),
  };
}

/**
 * Generate a W3C traceparent header string from a TraceContext.
 */
export function formatTraceparent(ctx: TraceContext): string {
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Parse a W3C tracestate header string.
 * Returns key-value pairs preserving order.
 */
export function parseTracestate(header: string): Array<[string, string]> {
  if (!header.trim()) return [];
  return header
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf('=');
      if (idx === -1) return null;
      return [entry.slice(0, idx).trim(), entry.slice(idx + 1).trim()] as [string, string];
    })
    .filter((e): e is [string, string] => e !== null);
}


/**
 * Format tracestate entries back into a header string.
 */
export function formatTracestate(entries: Array<[string, string]>): string {
  return entries.map(([k, v]) => `${k}=${v}`).join(',');
}

/**
 * Extract trace context from incoming request headers.
 */
export function extractTraceContext(headers: Record<string, string | undefined>): TraceContext | null {
  const traceparent = headers['traceparent'];
  if (!traceparent) return null;

  const ctx = parseTraceparent(traceparent);
  if (!ctx) return null;

  const tracestate = headers['tracestate'];
  if (tracestate) {
    ctx.traceState = tracestate;
  }

  return ctx;
}

/**
 * Inject trace context into outgoing request headers.
 */
export function injectTraceContext(ctx: TraceContext, headers: Record<string, string>): Record<string, string> {
  headers['traceparent'] = formatTraceparent(ctx);
  if (ctx.traceState) {
    headers['tracestate'] = ctx.traceState;
  }
  return headers;
}
