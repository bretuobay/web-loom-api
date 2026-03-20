/**
 * Serverless Example — AWS Lambda Handler
 *
 * createLambdaHandler() accepts an Application instance directly.
 * The app is initialized at module scope so it's reused across warm
 * invocations (typical cold start: ~80 ms).
 *
 * Deploy with: serverless deploy  /  AWS CDK  /  SAM
 */
import { createLambdaHandler } from '@web-loom/api-deployment-aws';
import type { LambdaHandler } from '@web-loom/api-deployment-aws';
import { getApp } from '../shared/app';

// Module-level init — cached across warm invocations
const appPromise = getApp();

// Lazily build the Lambda handler once the app is ready
let _handler: LambdaHandler | null = null;

export const handler: LambdaHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!_handler) {
    const app = await appPromise;
    _handler = createLambdaHandler(app);
  }

  return _handler(event, context);
};
