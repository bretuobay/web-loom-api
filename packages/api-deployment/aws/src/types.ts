// AWS Lambda specific types for the deployment adapter
// These types mirror the AWS Lambda runtime interfaces without requiring
// the @types/aws-lambda dependency.

// ==========================================================================
// Lambda Context
// ==========================================================================

/**
 * AWS Lambda execution context provided to the handler
 */
export interface LambdaContext {
  /** Name of the Lambda function */
  functionName: string;
  /** Version of the function */
  functionVersion: string;
  /** ARN of the invocation */
  invokedFunctionArn: string;
  /** Memory limit in MB */
  memoryLimitInMB: string;
  /** Unique request ID for this invocation */
  awsRequestId: string;
  /** CloudWatch log group name */
  logGroupName: string;
  /** CloudWatch log stream name */
  logStreamName: string;
  /** Returns remaining execution time in milliseconds */
  getRemainingTimeInMillis(): number;
}

// ==========================================================================
// API Gateway v1 (REST API) Types
// ==========================================================================

/**
 * API Gateway v1 proxy event (REST API)
 */
export interface APIGatewayProxyEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders: Record<string, string[] | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  multiValueQueryStringParameters: Record<string, string[] | undefined> | null;
  pathParameters: Record<string, string | undefined> | null;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext: {
    requestId: string;
    stage: string;
    identity: {
      sourceIp: string;
      userAgent: string | null;
    };
  };
  resource: string;
  stageVariables: Record<string, string | undefined> | null;
}

/**
 * API Gateway v1 proxy result
 */
export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded?: boolean;
}

// ==========================================================================
// API Gateway v2 (HTTP API) Types
// ==========================================================================

/**
 * API Gateway v2 event (HTTP API)
 */
export interface APIGatewayV2Event {
  version: '2.0';
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded: boolean;
  requestContext: {
    requestId: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    stage: string;
    time: string;
    timeEpoch: number;
  };
}

/**
 * API Gateway v2 proxy result
 */
export interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}

// ==========================================================================
// Lambda Function URL Types
// ==========================================================================

/**
 * Lambda Function URL event
 * Similar to API Gateway v2 but with Function URL-specific request context
 */
export interface LambdaFunctionURLEvent {
  version: '2.0';
  routeKey: '$default';
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded: boolean;
  requestContext: {
    requestId: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    time: string;
    timeEpoch: number;
  };
}

// ==========================================================================
// Lambda Handler Types
// ==========================================================================

/** Union of all supported Lambda event types */
export type LambdaEvent = APIGatewayProxyEvent | APIGatewayV2Event | LambdaFunctionURLEvent;

/** Lambda handler function signature */
export type LambdaHandler = (
  event: LambdaEvent,
  context: LambdaContext
) => Promise<APIGatewayProxyResult | APIGatewayProxyResultV2>;

/** Event source detected from the incoming Lambda event */
export type EventSource = 'api-gateway-v1' | 'api-gateway-v2' | 'function-url';

// ==========================================================================
// Configuration Types
// ==========================================================================

/**
 * Options for creating a Lambda handler
 */
export interface LambdaHandlerOptions {
  /** MIME types that should be base64-encoded in responses */
  binaryMediaTypes?: string[];
  /** Base path to strip from incoming request paths (e.g., '/prod') */
  stripBasePath?: string;
  /** Event field value that identifies a warmup/keep-alive event */
  warmupEvent?: string;
}

/**
 * RDS Proxy connection configuration
 */
export interface RDSProxyConfig {
  /** RDS Proxy endpoint hostname */
  host: string;
  /** Database port (default: 5432 for PostgreSQL) */
  port: number;
  /** Database name */
  database: string;
  /** Database username */
  username: string;
  /** Whether to use IAM authentication */
  useIAMAuth: boolean;
  /** AWS region for IAM auth token generation */
  region?: string;
  /** SSL/TLS mode */
  ssl: boolean;
  /** Maximum number of connections in the pool */
  maxConnections?: number;
  /** Connection idle timeout in milliseconds */
  idleTimeoutMs?: number;
}

/**
 * CloudWatch log entry structure
 */
export interface CloudWatchLogEntry {
  /** Log level */
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  /** Log message */
  message: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Lambda request ID */
  requestId?: string;
  /** X-Ray trace ID */
  traceId?: string;
  /** Additional structured context */
  context?: Record<string, unknown>;
}

/**
 * Lambda layer configuration
 */
export interface LambdaLayerConfig {
  /** Layer name */
  name: string;
  /** Layer ARN */
  arn: string;
  /** Layer version */
  version?: number;
}
