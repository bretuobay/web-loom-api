/**
 * Serverless Example — AWS Lambda Function (Manual Pattern)
 *
 * Manually maps API Gateway v2 events to Web Standard Request/Response.
 * Use this when you need full access to the Lambda context (requestId,
 * remainingTime, etc.) or direct AWS SDK calls inside the handler.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { getApp } from '../shared/app';

// Pre-warm: initialize before the first request
const appPromise = getApp();

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  // Avoid holding the Lambda container alive after responding
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const app = await appPromise;

    const url = `https://${event.requestContext.domainName}${event.rawPath}${
      event.rawQueryString ? `?${event.rawQueryString}` : ''
    }`;

    const request = new Request(url, {
      method: event.requestContext.http.method,
      headers: new Headers(event.headers as Record<string, string>),
      body: event.body
        ? event.isBase64Encoded
          ? Buffer.from(event.body, 'base64')
          : event.body
        : undefined,
    });

    const response = await app.handleRequest(request);

    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { statusCode: response.status, headers, body, isBase64Encoded: false };
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
}
