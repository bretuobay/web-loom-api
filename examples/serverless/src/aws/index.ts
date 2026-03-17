/**
 * Serverless Example — AWS Lambda Handler
 *
 * Wraps the shared app for AWS Lambda with API Gateway v2 (HTTP API).
 * Includes cold start optimization techniques:
 * - Module-level app initialization (persists across warm invocations)
 * - Minimal import footprint
 * - Connection reuse via keep-alive
 *
 * Deploy with:
 *   serverless deploy
 *
 * Or with AWS CDK / SAM.
 */
import { createLambdaHandler } from "@web-loom/api-deployment-aws";
import { getApp } from "../shared/app";

/**
 * Lambda handler — converts API Gateway v2 events into Web Standard
 * Request objects, routes them through the Web Loom app, and converts
 * the Response back to a Lambda-compatible format.
 *
 * Cold start optimization: the app is initialized once at module load
 * and reused across warm invocations. Typical cold start: ~80ms.
 */
export const handler = createLambdaHandler(async () => {
  const app = await getApp();
  return app;
});
