/**
 * Vercel deployment adapter types for Web Loom API Framework
 */

/** Vercel runtime options */
export type VercelRuntime = 'nodejs' | 'edge';

/** Vercel handler options */
export interface VercelHandlerOptions {
  /** Runtime to use: 'nodejs' (default) or 'edge' */
  runtime?: VercelRuntime;
  /** Vercel deployment regions */
  regions?: string[];
  /** Enable streaming responses */
  streaming?: boolean;
  /** Prefix for environment variable loading */
  envPrefix?: string;
}

/** Minimal Web Loom app interface for handler creation */
export interface WebLoomApp {
  handleRequest(request: Request): Promise<Response>;
}

/** Vercel environment variables */
export interface VercelEnvConfig {
  /** Current deployment environment */
  env: string;
  /** Deployment URL */
  url: string;
  /** Deployment region */
  region: string;
  /** Git commit SHA */
  gitCommitSha: string;
  /** Git commit ref */
  gitCommitRef: string;
  /** Custom app variables (loaded via prefix) */
  custom: Record<string, string>;
}

/** Vercel edge runtime config export */
export interface VercelEdgeConfig {
  runtime: 'edge';
  regions?: string[];
}

/** Vercel KV store interface (compatible with @vercel/kv) */
export interface VercelKVClient {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<string>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
}

/** Cache store interface for Web Loom framework */
export interface CacheStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
}

/** Region configuration for optimal deployment */
export interface RegionConfig {
  /** Primary target audience regions */
  primaryRegions?: string[];
  /** Whether to auto-detect optimal regions */
  autoDetect?: boolean;
  /** Maximum number of regions to deploy to */
  maxRegions?: number;
}
