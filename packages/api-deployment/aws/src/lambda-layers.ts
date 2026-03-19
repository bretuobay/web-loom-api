// Lambda Layers support utilities
// Helps resolve and manage dependencies deployed as Lambda layers

import type { LambdaLayerConfig } from './types';

/** Base path where Lambda layers are mounted */
const LAYER_BASE_PATH = '/opt';

/** Node.js modules path within a Lambda layer */
const LAYER_NODEJS_PATH = `${LAYER_BASE_PATH}/nodejs/node_modules`;

/**
 * Resolve the filesystem path for a module within a Lambda layer.
 *
 * Lambda layers are extracted to /opt in the execution environment.
 * Node.js modules in layers are at /opt/nodejs/node_modules/<module>.
 *
 * @param layerName - The npm package name within the layer
 * @returns Absolute path to the module in the layer
 */
export function resolveLayerPath(layerName: string): string {
  return `${LAYER_NODEJS_PATH}/${layerName}`;
}

/**
 * List available layer dependencies by checking the layer mount path.
 *
 * In a real Lambda environment, this reads the /opt/nodejs/node_modules
 * directory. Outside Lambda, returns an empty array.
 *
 * @returns Array of available module names from layers
 */
export function getLayerDependencies(): string[] {
  try {
    // Dynamic require to avoid bundling fs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    if (fs.existsSync(LAYER_NODEJS_PATH)) {
      const entries: string[] = fs.readdirSync(LAYER_NODEJS_PATH);
      return entries.filter((entry: string) => !entry.startsWith('.'));
    }
  } catch {
    // Not in a Lambda environment or layers not available
  }
  return [];
}

/**
 * Create Lambda layer configuration objects from layer definitions.
 *
 * Generates the ARN-based configuration needed for Lambda deployment
 * tools (SAM, CDK, Serverless Framework).
 *
 * @param layers - Array of layer definitions with name, ARN, and optional version
 * @returns Array of fully-resolved layer configurations
 */
export function createLayerConfig(
  layers: Array<{ name: string; arn: string; version?: number }>
): LambdaLayerConfig[] {
  return layers.map((layer) => {
    const config: LambdaLayerConfig = {
      name: layer.name,
      arn: layer.version ? `${layer.arn}:${layer.version}` : layer.arn,
    };

    if (layer.version !== undefined) {
      config.version = layer.version;
    }

    return config;
  });
}
