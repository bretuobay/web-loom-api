/**
 * @web-loom/api-adapter-hono
 * 
 * Hono adapter for Web Loom API Framework
 * 
 * Provides a lightweight, edge-optimized HTTP framework adapter using Hono.
 * 
 * @example
 * ```typescript
 * import { HonoAdapter } from '@web-loom/api-adapter-hono';
 * 
 * const adapter = new HonoAdapter();
 * adapter.registerRoute('GET', '/hello', async (ctx) => {
 *   return new Response(JSON.stringify({ message: 'Hello World' }));
 * });
 * await adapter.listen(3000);
 * ```
 */

export { HonoAdapter } from './hono-adapter';
export const ADAPTER_NAME = 'hono';
