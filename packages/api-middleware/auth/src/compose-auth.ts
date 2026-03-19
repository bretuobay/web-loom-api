import type { MiddlewareHandler } from 'hono';

/**
 * Multi-strategy authentication middleware.
 *
 * Tries each strategy in order. Stops and calls `next()` as soon as one
 * successfully sets `c.var.user`. If all strategies fail (none set the user),
 * returns 401.
 *
 * @example
 * ```ts
 * // Accept either a JWT or an API key
 * app.use('/api/*', composeAuth(
 *   jwtAuth({ secret: env.JWT_SECRET, optional: true }),
 *   apiKeyAuth({ validate: (key) => db.findApiKey(key) }),
 * ));
 * ```
 */
export function composeAuth(...middlewares: MiddlewareHandler[]): MiddlewareHandler {
  return async (c, next) => {
    for (const middleware of middlewares) {
      let succeeded = false;

      // Run the middleware, capturing whether it reached next()
      await middleware(c, async () => {
        succeeded = true;
      });

      if (succeeded && c.var.user) {
        await next();
        return;
      }
    }

    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  };
}
