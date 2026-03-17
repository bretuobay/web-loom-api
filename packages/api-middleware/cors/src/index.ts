/**
 * @web-loom/api-middleware-cors
 *
 * CORS middleware for Web Loom API Framework.
 * Handles preflight OPTIONS requests and adds CORS headers to responses.
 */

// Middleware
export { cors } from './cors';

// Types
export type { CorsOptions, CorsOrigin, OriginFunction } from './types';
