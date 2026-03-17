// API Gateway event conversion utilities
// Converts between Lambda events and Web Standards Request/Response

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayV2Event,
  APIGatewayProxyResultV2,
  LambdaFunctionURLEvent,
  LambdaEvent,
  EventSource,
} from './types';

/**
 * Detect the event source from a Lambda event
 */
export function detectEventSource(event: LambdaEvent): EventSource {
  // API Gateway v2 and Function URL both have version '2.0'
  if ('version' in event && event.version === '2.0') {
    // Function URL events have routeKey '$default' and domainName in requestContext
    if (
      'routeKey' in event &&
      event.routeKey === '$default' &&
      'requestContext' in event &&
      event.requestContext &&
      'domainName' in event.requestContext
    ) {
      return 'function-url';
    }
    return 'api-gateway-v2';
  }
  return 'api-gateway-v1';
}

/**
 * Parse an API Gateway v1 (REST API) event into a Web Standards Request
 */
export function parseAPIGatewayV1Event(
  event: APIGatewayProxyEvent,
  stripBasePath?: string
): Request {
  let path = event.path || '/';
  if (stripBasePath && path.startsWith(stripBasePath)) {
    path = path.slice(stripBasePath.length) || '/';
  }

  // Build query string from multi-value parameters first, fall back to single-value
  const searchParams = new URLSearchParams();
  if (event.multiValueQueryStringParameters) {
    for (const [key, values] of Object.entries(event.multiValueQueryStringParameters)) {
      if (values) {
        for (const val of values) {
          searchParams.append(key, val);
        }
      }
    }
  } else if (event.queryStringParameters) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value !== undefined) {
        searchParams.set(key, value);
      }
    }
  }

  const queryString = searchParams.toString();
  const url = `https://lambda.local${path}${queryString ? `?${queryString}` : ''}`;

  // Merge headers (prefer multi-value if it has entries, fall back to single-value)
  const headers = new Headers();
  const multiValueEntries = event.multiValueHeaders
    ? Object.entries(event.multiValueHeaders).filter(([, v]) => v && v.length > 0)
    : [];

  if (multiValueEntries.length > 0) {
    for (const [key, values] of multiValueEntries) {
      if (values) {
        for (const val of values) {
          headers.append(key, val);
        }
      }
    }
  } else if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers.set(key, value);
      }
    }
  }

  const method = event.httpMethod;
  const hasBody = event.body !== null && !['GET', 'HEAD'].includes(method);

  return new Request(url, {
    method,
    headers,
    body: hasBody
      ? event.isBase64Encoded
        ? Buffer.from(event.body!, 'base64')
        : event.body!
      : undefined,
  });
}

/**
 * Parse an API Gateway v2 (HTTP API) event into a Web Standards Request
 */
export function parseAPIGatewayV2Event(
  event: APIGatewayV2Event,
  stripBasePath?: string
): Request {
  let path = event.rawPath || '/';
  if (stripBasePath && path.startsWith(stripBasePath)) {
    path = path.slice(stripBasePath.length) || '/';
  }

  const queryString = event.rawQueryString || '';
  const url = `https://lambda.local${path}${queryString ? `?${queryString}` : ''}`;

  const headers = new Headers();
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers.set(key, value);
      }
    }
  }

  const method = event.requestContext.http.method;
  const hasBody = event.body !== undefined && !['GET', 'HEAD'].includes(method);

  return new Request(url, {
    method,
    headers,
    body: hasBody
      ? event.isBase64Encoded
        ? Buffer.from(event.body!, 'base64')
        : event.body!
      : undefined,
  });
}

/**
 * Parse a Lambda Function URL event into a Web Standards Request
 */
export function parseFunctionURLEvent(
  event: LambdaFunctionURLEvent,
  stripBasePath?: string
): Request {
  let path = event.rawPath || '/';
  if (stripBasePath && path.startsWith(stripBasePath)) {
    path = path.slice(stripBasePath.length) || '/';
  }

  const queryString = event.rawQueryString || '';
  const url = `https://lambda.local${path}${queryString ? `?${queryString}` : ''}`;

  const headers = new Headers();
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers.set(key, value);
      }
    }
  }

  const method = event.requestContext.http.method;
  const hasBody = event.body !== undefined && !['GET', 'HEAD'].includes(method);

  return new Request(url, {
    method,
    headers,
    body: hasBody
      ? event.isBase64Encoded
        ? Buffer.from(event.body!, 'base64')
        : event.body!
      : undefined,
  });
}

/**
 * Check if a content type should be base64-encoded in the response
 */
function isBinaryContentType(contentType: string, binaryMediaTypes: string[]): boolean {
  if (binaryMediaTypes.length === 0) return false;
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return binaryMediaTypes.some((type) => {
    if (type === '*/*') return true;
    if (type.endsWith('/*')) {
      return normalized.startsWith(type.slice(0, -1));
    }
    return normalized === type.toLowerCase();
  });
}

/**
 * Format a Web Standards Response into an API Gateway v1 result
 */
export async function formatAPIGatewayV1Response(
  response: Response,
  binaryMediaTypes: string[] = []
): Promise<APIGatewayProxyResult> {
  const contentType = response.headers.get('content-type') || '';
  const isBinary = isBinaryContentType(contentType, binaryMediaTypes);

  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};

  response.headers.forEach((value, key) => {
    // set-cookie can have multiple values
    if (key.toLowerCase() === 'set-cookie') {
      multiValueHeaders[key] = multiValueHeaders[key] || [];
      multiValueHeaders[key].push(value);
    } else {
      headers[key] = value;
    }
  });

  let body: string;
  let isBase64Encoded = false;

  if (isBinary) {
    const buffer = Buffer.from(await response.arrayBuffer());
    body = buffer.toString('base64');
    isBase64Encoded = true;
  } else {
    body = await response.text();
  }

  return {
    statusCode: response.status,
    headers,
    multiValueHeaders: Object.keys(multiValueHeaders).length > 0 ? multiValueHeaders : undefined,
    body,
    isBase64Encoded,
  };
}

/**
 * Format a Web Standards Response into an API Gateway v2 result
 */
export async function formatAPIGatewayV2Response(
  response: Response,
  binaryMediaTypes: string[] = []
): Promise<APIGatewayProxyResultV2> {
  const contentType = response.headers.get('content-type') || '';
  const isBinary = isBinaryContentType(contentType, binaryMediaTypes);

  const headers: Record<string, string> = {};
  const cookies: string[] = [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      cookies.push(value);
    } else {
      headers[key] = value;
    }
  });

  let body: string | undefined;
  let isBase64Encoded = false;

  if (isBinary) {
    const buffer = Buffer.from(await response.arrayBuffer());
    body = buffer.toString('base64');
    isBase64Encoded = true;
  } else {
    body = await response.text();
  }

  return {
    statusCode: response.status,
    headers,
    body,
    isBase64Encoded,
    ...(cookies.length > 0 ? { cookies } : {}),
  };
}
