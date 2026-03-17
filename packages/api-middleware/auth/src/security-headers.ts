/**
 * Security Headers Middleware
 *
 * Adds security-related HTTP headers to all responses following best practices.
 * Configurable with sensible defaults for X-Content-Type-Options, X-Frame-Options,
 * X-XSS-Protection, Strict-Transport-Security, and Content-Security-Policy.
 *
 * @example
 * ```typescript
 * import { securityHeaders } from '@web-loom/api-middleware-auth';
 *
 * // Use with defaults
 * app.use(securityHeaders());
 *
 * // Custom CSP
 * app.use(securityHeaders({
 *   contentSecurityPolicy: "default-src 'self'; script-src 'self' cdn.example.com",
 * }));
 * ```
 *
 * Requirements: 53.1, 53.2, 53.3, 53.4, 53.5, 53.6, 53.7
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';

/** Options for configuring security headers */
export interface SecurityHeadersOptions {
  /** X-Content-Type-Options header value (default: 'nosniff'). Set to false to omit. */
  contentTypeOptions?: string | false | undefined;
  /** X-Frame-Options header value (default: 'DENY'). Set to false to omit. */
  frameOptions?: string | false | undefined;
  /** X-XSS-Protection header value (default: '0', modern recommendation). Set to false to omit. */
  xssProtection?: string | false | undefined;
  /** Strict-Transport-Security value (default: 'max-age=31536000; includeSubDomains'). Set to false to omit. */
  strictTransportSecurity?: string | false | undefined;
  /** Content-Security-Policy value (default: "default-src 'self'"). Set to false to omit. */
  contentSecurityPolicy?: string | false | undefined;
  /** Remove X-Powered-By header (default: true) */
  removePoweredBy?: boolean | undefined;
  /** Remove Server header (default: true) */
  removeServerHeader?: boolean | undefined;
  /** Additional custom headers to set */
  customHeaders?: Record<string, string> | undefined;
}

/**
 * Create security headers middleware.
 *
 * Applies security headers to every response. Headers can be individually
 * configured or disabled by setting them to `false`.
 *
 * @param options - Optional configuration overrides
 * @returns Middleware function
 */
export function securityHeaders(
  options: SecurityHeadersOptions = {},
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  const contentTypeOptions = options.contentTypeOptions ?? 'nosniff';
  const frameOptions = options.frameOptions ?? 'DENY';
  const xssProtection = options.xssProtection ?? '0';
  const strictTransportSecurity =
    options.strictTransportSecurity ?? 'max-age=31536000; includeSubDomains';
  const contentSecurityPolicy =
    options.contentSecurityPolicy ?? "default-src 'self'";
  const removePoweredBy = options.removePoweredBy ?? true;
  const removeServerHeader = options.removeServerHeader ?? true;
  const customHeaders = options.customHeaders;

  return async (_ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const response = await next();

    const headers = new Headers(response.headers);

    if (contentTypeOptions !== false) {
      headers.set('X-Content-Type-Options', contentTypeOptions);
    }
    if (frameOptions !== false) {
      headers.set('X-Frame-Options', frameOptions);
    }
    if (xssProtection !== false) {
      headers.set('X-XSS-Protection', xssProtection);
    }
    if (strictTransportSecurity !== false) {
      headers.set('Strict-Transport-Security', strictTransportSecurity);
    }
    if (contentSecurityPolicy !== false) {
      headers.set('Content-Security-Policy', contentSecurityPolicy);
    }

    if (removePoweredBy) {
      headers.delete('X-Powered-By');
    }
    if (removeServerHeader) {
      headers.delete('Server');
    }

    if (customHeaders) {
      for (const [name, value] of Object.entries(customHeaders)) {
        headers.set(name, value);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
