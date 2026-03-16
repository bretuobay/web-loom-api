/**
 * Input Sanitization Utilities
 *
 * Provides HTML escaping, recursive object sanitization, path traversal detection,
 * and request size limit middleware to protect against injection attacks.
 *
 * @example
 * ```typescript
 * import { sanitize, sanitizeObject, isPathTraversal, requestSizeLimit } from '@web-loom/api-middleware-validation';
 *
 * sanitize('<script>alert("xss")</script>');
 * // => '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 *
 * isPathTraversal('../etc/passwd'); // => true
 *
 * app.use(requestSizeLimit(1024 * 1024)); // 1 MB
 * ```
 *
 * Requirements: 55.1, 55.2, 54.1, 54.2, 54.7
 */

import type { RequestContext, NextFunction } from '@web-loom/api-core';

// ---------------------------------------------------------------------------
// HTML entity escaping
// ---------------------------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const HTML_ESCAPE_RE = /[&<>"']/g;

/**
 * Escape HTML special characters in a string to prevent XSS.
 *
 * @param input - Raw string
 * @returns Escaped string safe for HTML contexts
 */
export function sanitize(input: string): string {
  return input.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

// ---------------------------------------------------------------------------
// Recursive object sanitization
// ---------------------------------------------------------------------------

/**
 * Recursively sanitize all string values in an object.
 *
 * Arrays and nested objects are traversed. Non-string primitives are
 * returned as-is.
 *
 * @param obj - Object to sanitize
 * @returns A new object with all string values HTML-escaped
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitize(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }

  // Primitives (number, boolean, null, undefined)
  return obj;
}

// ---------------------------------------------------------------------------
// Path traversal detection
// ---------------------------------------------------------------------------

/**
 * Detect path traversal patterns in a string.
 *
 * Checks for `..`, encoded variants (`%2e%2e`), and null bytes.
 *
 * @param path - Path string to check
 * @returns `true` if the path contains traversal patterns
 */
export function isPathTraversal(path: string): boolean {
  const decoded = decodeURIComponent(path);

  // Check for .. segments (with / or \ separators)
  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(decoded)) {
    return true;
  }

  // Standalone ".." without separators
  if (decoded === '..') {
    return true;
  }

  // Null byte injection
  if (decoded.includes('\0')) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Request size limit middleware
// ---------------------------------------------------------------------------

/**
 * Create middleware that rejects requests exceeding a byte-size limit.
 *
 * The check uses the `Content-Length` header when available. If the header
 * is absent the request is allowed through (streaming scenarios).
 *
 * @param maxBytes - Maximum allowed request body size in bytes (default: 1 MB)
 * @returns Middleware function
 */
export function requestSizeLimit(
  maxBytes: number = 1_048_576,
): (ctx: RequestContext, next: NextFunction) => Promise<Response> {
  return async (ctx: RequestContext, next: NextFunction): Promise<Response> => {
    const contentLength = ctx.request.headers.get('Content-Length');

    if (contentLength !== null) {
      const size = parseInt(contentLength, 10);

      if (!Number.isNaN(size) && size > maxBytes) {
        return new Response(
          JSON.stringify({
            error: 'Payload Too Large',
            message: `Request body exceeds the maximum allowed size of ${maxBytes} bytes`,
            code: 'PAYLOAD_TOO_LARGE',
            maxBytes,
          }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    return next();
  };
}
