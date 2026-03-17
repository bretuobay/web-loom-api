// Vercel deployment adapter for Web Loom API Framework
export type {
  VercelRuntime,
  VercelHandlerOptions,
  WebLoomApp,
  VercelEnvConfig,
  VercelEdgeConfig,
  VercelKVClient,
  CacheStore,
  RegionConfig,
} from './types';

export { createVercelHandler, loadVercelEnv, createStreamingResponse } from './vercel-handler';
export { detectRuntime, isEdgeRuntime, createEdgeConfig, getOptimalRegions } from './edge-runtime';
export { VercelKVCacheStore } from './vercel-kv';
