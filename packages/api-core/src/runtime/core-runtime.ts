/**
 * CoreRuntime — thin compatibility shim
 *
 * The previous adapter-based `CoreRuntime` class has been replaced by
 * `createApp()`. This module re-exports `createApp` and the `Application`
 * interface for backwards compatibility with any code that previously
 * imported from `@web-loom/api-core/runtime`.
 *
 * @deprecated Use `createApp()` from `@web-loom/api-core` directly.
 */

export { createApp } from '../app/create-app';
export type { Application } from '../types';

// Legacy type alias kept for existing imports
export type AdapterType = 'database' | 'email';
