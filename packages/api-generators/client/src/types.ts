/**
 * TypeScript Client Generator Types
 */

/**
 * Client generator options
 */
export interface ClientGeneratorOptions {
  /** Client class name */
  className?: string;

  /** Base URL for API requests */
  baseUrl?: string;

  /** Include fetch implementation */
  includeFetch?: boolean;

  /** Generate error classes */
  generateErrors?: boolean;

  /** Add request/response interceptors */
  includeInterceptors?: boolean;

  /** Generate retry logic */
  includeRetry?: boolean;

  /** Add request cancellation support */
  includeCancellation?: boolean;

  /** Include JSDoc comments */
  includeJSDoc?: boolean;

  /** Generate React hooks */
  generateReactHooks?: boolean;

  /** Export format */
  exportFormat?: 'esm' | 'cjs' | 'both';
}

/**
 * Generated client file structure
 */
export interface GeneratedClient {
  /** TypeScript interfaces */
  types: string;

  /** Client class implementation */
  client: string;

  /** Error classes */
  errors?: string;

  /** Utility functions */
  utils?: string;

  /** React hooks */
  hooks?: string;
}

/**
 * HTTP method type
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Request configuration
 */
export interface RequestConfig {
  /** Request headers */
  headers?: Record<string, string>;

  /** Query parameters */
  params?: Record<string, unknown>;

  /** Request body */
  body?: unknown;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Response type
 */
export interface APIResponse<T = unknown> {
  /** Response data */
  data: T;

  /** HTTP status code */
  status: number;

  /** Response headers */
  headers: Record<string, string>;
}

/**
 * Error response type
 */
export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
    path?: string;
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;

  /** Initial delay in milliseconds */
  initialDelay: number;

  /** Maximum delay in milliseconds */
  maxDelay: number;

  /** Backoff multiplier */
  backoffMultiplier: number;

  /** HTTP status codes to retry */
  retryableStatusCodes: number[];
}

/**
 * Interceptor function type
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor<T = unknown> = (
  response: APIResponse<T>
) => APIResponse<T> | Promise<APIResponse<T>>;
export type ErrorInterceptor = (error: Error) => Error | Promise<Error>;
