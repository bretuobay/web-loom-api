import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodSchema } from 'zod';

/**
 * Validation middleware wrapper around `@hono/zod-validator`.
 *
 * Formats Zod errors into the standard `VALIDATION_ERROR` response shape and
 * attaches a UUIDv4 `requestId` to every error response.
 *
 * @example
 * ```ts
 * import { validate } from '@web-loom/api-core';
 *
 * app.post('/', validate('json', User.insertSchema), async (c) => {
 *   const data = c.req.valid('json'); // typed
 *   // ...
 * });
 * ```
 */
export function validate<T extends keyof ValidationTargets>(
  target: T,
  schema: ZodSchema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const requestId = crypto.randomUUID();
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            requestId,
            timestamp: new Date().toISOString(),
            details: {
              fields: result.error.issues.map((issue) => ({
                path: issue.path.map(String),
                message: issue.message,
                code: issue.code,
              })),
            },
          },
        },
        400,
      );
    }
    return undefined;
  });
}
