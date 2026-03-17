/**
 * Serverless Example — AWS Lambda Function (Manual Pattern)
 *
 * Shows how to write a Lambda handler manually without the deployment
 * adapter, for cases where you need full control over the Lambda lifecycle.
 * Demonstrates cold start optimization with provisioned concurrency hints.
 */
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { getApp } from "../shared/app";

// Initialize outside the handler for connection reuse across warm invocations
const appPromise = getApp();

/**
 * Manual Lambda handler with full control over request/response mapping.
 * Use this pattern when you need to:
 * - Access raw Lambda context (requestId, remainingTime, etc.)
 * - Add custom error handling or logging
 * - Integrate with other AWS services directly
 */
export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  // Don't wait for event loop to drain — improves response time
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const app = await appPromise;

    // Convert API Gateway event to a Web Standard Request
    const url = `https://${event.requestContext.domainName}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`;

    const request = new Request(url, {
      method: event.requestContext.http.method,
      headers: new Headers(event.headers as Record<string, string>),
      body: event.body
        ? event.isBase64Encoded
          ? Buffer.from(event.body, "base64")
          : event.body
        : undefined,
    });

    // Route through the Web Loom app
    const response = await app.handleRequest(request);

    // Convert back to API Gateway format
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      statusCode: response.status,
      headers,
      body,
      isBase64Encoded: false,
    };
  } catch (error) {
    console.error("Lambda handler error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
}
