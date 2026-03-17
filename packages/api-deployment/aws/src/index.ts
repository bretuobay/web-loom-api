// AWS Lambda deployment adapter for Web Loom API Framework
export const ADAPTER_NAME = 'aws';

// Main handler factory
export { createLambdaHandler } from './lambda-handler';
export type { LambdaApp } from './lambda-handler';

// API Gateway event conversion
export {
  detectEventSource,
  parseAPIGatewayV1Event,
  parseAPIGatewayV2Event,
  parseFunctionURLEvent,
  formatAPIGatewayV1Response,
  formatAPIGatewayV2Response,
} from './api-gateway';

// RDS Proxy connection management
export { RDSProxyManager, createRDSProxyConfig } from './rds-proxy';

// Cold start optimization
export { ColdStartOptimizer } from './cold-start';

// CloudWatch Logs integration
export { CloudWatchLogger, formatForCloudWatch } from './cloudwatch';

// Lambda Layers support
export { resolveLayerPath, getLayerDependencies, createLayerConfig } from './lambda-layers';

// Types
export type {
  LambdaContext,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayV2Event,
  APIGatewayProxyResultV2,
  LambdaFunctionURLEvent,
  LambdaEvent,
  LambdaHandler,
  EventSource,
  LambdaHandlerOptions,
  RDSProxyConfig,
  CloudWatchLogEntry,
  LambdaLayerConfig,
} from './types';
