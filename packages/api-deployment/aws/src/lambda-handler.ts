// Main Lambda handler factory
// Creates an AWS Lambda handler from a Web Loom API application

import type {
  LambdaEvent,
  LambdaContext,
  LambdaHandler,
  LambdaHandlerOptions,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
} from './types';
import {
  detectEventSource,
  parseAPIGatewayV1Event,
  parseAPIGatewayV2Event,
  parseFunctionURLEvent,
  formatAPIGatewayV1Response,
  formatAPIGatewayV2Response,
} from './api-gateway';
import { ColdStartOptimizer } from './cold-start';
import { CloudWatchLogger } from './cloudwatch';
import type { APIGatewayProxyEvent, APIGatewayV2Event, LambdaFunctionURLEvent } from './types';

/**
 * Application interface expected by the Lambda handler.
 * Compatible with the Web Loom Application's handleRequest method.
 */
export interface LambdaApp {
  handleRequest(request: Request): Promise<Response>;
}

/**
 * Create an AWS Lambda handler from a Web Loom API application.
 *
 * The handler automatically detects the event source (API Gateway v1, v2,
 * or Function URL) and converts between Lambda events and Web Standards
 * Request/Response objects.
 *
 * @param app - Application with a handleRequest method
 * @param options - Optional handler configuration
 * @returns Lambda handler function
 *
 * @example
 * ```typescript
 * import { createLambdaHandler } from '@web-loom/api-deployment-aws';
 *
 * const app = createApp(); // Your Web Loom app
 * export const handler = createLambdaHandler(app, {
 *   binaryMediaTypes: ['image/*', 'application/pdf'],
 *   stripBasePath: '/prod',
 * });
 * ```
 */
export function createLambdaHandler(
  app: LambdaApp,
  options: LambdaHandlerOptions = {}
): LambdaHandler {
  const { binaryMediaTypes = [], stripBasePath, warmupEvent } = options;
  const optimizer = new ColdStartOptimizer();
  const logger = new CloudWatchLogger({ adapter: 'aws-lambda' });

  const handler: LambdaHandler = async (
    event: LambdaEvent,
    context: LambdaContext
  ): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> => {
    // Set up logging context
    logger.setLambdaContext(context);

    // Handle warmup events
    if (warmupEvent && isWarmupByField(event, warmupEvent)) {
      logger.debug('Warmup event received');
      return { statusCode: 200, body: '{"message":"warm"}' };
    }

    // Track cold start
    optimizer.trackColdStart();
    if (optimizer.getColdStartDuration() !== null) {
      logger.info('Cold start completed', {
        duration: optimizer.getColdStartDuration(),
      });
    }

    // Detect event source and convert to Request
    const source = detectEventSource(event);
    let request: Request;

    try {
      switch (source) {
        case 'api-gateway-v1':
          request = parseAPIGatewayV1Event(event as APIGatewayProxyEvent, stripBasePath);
          break;
        case 'api-gateway-v2':
          request = parseAPIGatewayV2Event(event as APIGatewayV2Event, stripBasePath);
          break;
        case 'function-url':
          request = parseFunctionURLEvent(event as LambdaFunctionURLEvent, stripBasePath);
          break;
      }
    } catch (err) {
      logger.error('Failed to parse Lambda event', {
        source,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error: failed to parse request' }),
      };
    }

    // Process request through the application
    try {
      const response = await app.handleRequest(request);

      // Format response based on event source
      if (source === 'api-gateway-v1') {
        return formatAPIGatewayV1Response(response, binaryMediaTypes);
      }
      return formatAPIGatewayV2Response(response, binaryMediaTypes);
    } catch (err) {
      logger.error('Unhandled error in request processing', {
        source,
        path: request.url,
        method: request.method,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  };

  return handler;
}

/**
 * Check if an event matches the configured warmup event field
 */
function isWarmupByField(event: LambdaEvent, warmupField: string): boolean {
  const record = event as unknown as Record<string, unknown>;
  return record['source'] === warmupField || record[warmupField] !== undefined;
}
