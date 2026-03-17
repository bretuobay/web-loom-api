/**
 * CORS Middleware Types
 *
 * Type definitions for Cross-Origin Resource Sharing middleware.
 */

/**
 * Function that dynamically determines if an origin is allowed.
 *
 * @param origin - The request Origin header value
 * @returns Whether the origin is allowed, or a Promise resolving to the same
 */
export type OriginFunction = (origin: string) => boolean | Promise<boolean>;

/**
 * Allowed origin specification.
 *
 * - `'*'` — allow all origins (wildcard)
 * - `string` — exact origin match
 * - `RegExp` — regex match against origin
 * - `string[]` — whitelist of exact origins
 * - `RegExp[]` — list of regex patterns
 * - `OriginFunction` — custom async/sync function
 */
export type CorsOrigin =
  | '*'
  | string
  | RegExp
  | string[]
  | RegExp[]
  | OriginFunction;

/**
 * Configuration options for the CORS middleware.
 */
export interface CorsOptions {
  /**
   * Configures the Access-Control-Allow-Origin header.
   * @default '*'
   */
  origin?: CorsOrigin | undefined;

  /**
   * Configures the Access-Control-Allow-Methods header.
   * @default ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
   */
  methods?: string[] | undefined;


  /**
   * Configures the Access-Control-Allow-Headers header.
   * If not set, reflects the request's Access-Control-Request-Headers.
   */
  allowedHeaders?: string[] | undefined;

  /**
   * Configures the Access-Control-Expose-Headers header.
   */
  exposedHeaders?: string[] | undefined;

  /**
   * Configures the Access-Control-Allow-Credentials header.
   * When true, the wildcard origin is never sent — the request origin is reflected instead.
   * @default false
   */
  credentials?: boolean | undefined;

  /**
   * Configures the Access-Control-Max-Age header (in seconds).
   */
  maxAge?: number | undefined;

  /**
   * If true, passes the preflight OPTIONS request to the next handler
   * instead of short-circuiting with a 204 response.
   * @default false
   */
  preflightContinue?: boolean | undefined;
}
