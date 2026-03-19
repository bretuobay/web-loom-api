import { randomUUID } from 'node:crypto';
import type { ErrorHandler } from 'hono';
import { ValidationError, WebLoomError } from '@web-loom/api-shared';

/**
 * Global Hono error handler.
 *
 * - Maps known `WebLoomError` subclasses to their HTTP status codes.
 * - Generates a UUIDv4 `requestId` and adds it to both the response body and
 *   the `X-Request-Id` header.
 * - Suppresses stack traces and internal details in production.
 */
export const globalErrorHandler: ErrorHandler = (err, c) => {
  const requestId = randomUUID();
  const path = new URL(c.req.url).pathname;
  const isProd = process.env.NODE_ENV === 'production';

  const base = {
    requestId,
    path,
    timestamp: new Date().toISOString(),
  };

  const headers: Record<string, string> = {
    'X-Request-Id': requestId,
  };

  // Validation errors (400) — include field details
  if (err instanceof ValidationError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...base,
          details: err.details,
        },
      },
      400,
      headers
    );
  }

  // Known WebLoom errors — use their built-in status codes
  if (err instanceof WebLoomError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...base,
          ...(err.details ? { details: err.details } : {}),
          ...(!isProd && err.stack ? { stack: err.stack } : {}),
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err.statusCode ?? 500) as any,
      headers
    );
  }

  // Unknown errors — mask in production
  const message = isProd ? 'Internal server error' : err.message;
  if (!isProd) {
    console.error(`[${requestId}]`, err);
  }

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message,
        ...base,
        ...(!isProd && err.stack ? { stack: err.stack } : {}),
      },
    },
    500,
    headers
  );
};
