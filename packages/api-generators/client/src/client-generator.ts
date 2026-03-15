/**
 * TypeScript Client Generator
 * 
 * Generates type-safe TypeScript API clients from model and route definitions
 */

import type { ClientGeneratorOptions, GeneratedClient, HTTPMethod } from './types';
import {
  fieldTypeToTS,
  modelToInterfaceName,
  pathToMethodName,
  extractPathParams,
  generateJSDoc,
  capitalize,
} from './code-generator';

/**
 * Model definition for client generation
 */
export interface ModelDefinition {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    validation?: {
      required?: boolean;
    };
  }>;
  metadata?: {
    description?: string;
  };
}

/**
 * Route definition for client generation
 */
export interface RouteDefinition {
  path: string;
  method: HTTPMethod;
  metadata?: {
    description?: string;
    tags?: string[];
  };
}

/**
 * TypeScript Client Generator Class
 */
export class ClientGenerator {
  private models: Map<string, ModelDefinition> = new Map();
  private routes: RouteDefinition[] = [];
  private options: Required<ClientGeneratorOptions>;

  constructor(options: ClientGeneratorOptions = {}) {
    this.options = {
      className: options.className || 'APIClient',
      baseUrl: options.baseUrl || '',
      includeFetch: options.includeFetch ?? true,
      generateErrors: options.generateErrors ?? true,
      includeInterceptors: options.includeInterceptors ?? true,
      includeRetry: options.includeRetry ?? true,
      includeCancellation: options.includeCancellation ?? true,
      includeJSDoc: options.includeJSDoc ?? true,
      exportFormat: options.exportFormat || 'esm',
    };
  }

  /**
   * Register a model definition
   */
  registerModel(model: ModelDefinition): void {
    this.models.set(model.name, model);
  }

  /**
   * Register multiple model definitions
   */
  registerModels(models: ModelDefinition[]): void {
    for (const model of models) {
      this.registerModel(model);
    }
  }

  /**
   * Register a route definition
   */
  registerRoute(route: RouteDefinition): void {
    this.routes.push(route);
  }

  /**
   * Register multiple route definitions
   */
  registerRoutes(routes: RouteDefinition[]): void {
    this.routes.push(...routes);
  }

  /**
   * Generate complete client code
   */
  generate(): GeneratedClient {
    const result: GeneratedClient = {
      types: this.generateTypes(),
      client: this.generateClient(),
      utils: this.generateUtils(),
    };

    if (this.options.generateErrors) {
      result.errors = this.generateErrors();
    }

    return result;
  }

  /**
   * Generate TypeScript interfaces from models
   */
  private generateTypes(): string {
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(' * Generated TypeScript Types');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    // Generate model interfaces
    for (const [name, model] of this.models) {
      if (this.options.includeJSDoc && model.metadata?.description) {
        lines.push(`/**`);
        lines.push(` * ${model.metadata.description}`);
        lines.push(` */`);
      }
      
      lines.push(`export interface ${modelToInterfaceName(name)} {`);
      
      for (const field of model.fields) {
        const optional = !field.required && !field.validation?.required;
        const tsType = fieldTypeToTS(field.type);
        lines.push(`  ${field.name}${optional ? '?' : ''}: ${tsType};`);
      }
      
      lines.push('}');
      lines.push('');
    }

    // Generate request/response types
    lines.push('/**');
    lines.push(' * API Response wrapper');
    lines.push(' */');
    lines.push('export interface APIResponse<T = unknown> {');
    lines.push('  data: T;');
    lines.push('  status: number;');
    lines.push('  headers: Record<string, string>;');
    lines.push('}');
    lines.push('');

    lines.push('/**');
    lines.push(' * API Error response');
    lines.push(' */');
    lines.push('export interface APIErrorResponse {');
    lines.push('  error: {');
    lines.push('    code: string;');
    lines.push('    message: string;');
    lines.push('    details?: unknown;');
    lines.push('    timestamp: string;');
    lines.push('    requestId: string;');
    lines.push('    path?: string;');
    lines.push('  };');
    lines.push('}');
    lines.push('');

    // Generate pagination type
    lines.push('/**');
    lines.push(' * Paginated response');
    lines.push(' */');
    lines.push('export interface PaginatedResponse<T> {');
    lines.push('  data: T[];');
    lines.push('  pagination: {');
    lines.push('    page: number;');
    lines.push('    limit: number;');
    lines.push('    total: number;');
    lines.push('    totalPages: number;');
    lines.push('  };');
    lines.push('}');
    lines.push('');

    // Generate request config type
    lines.push('/**');
    lines.push(' * Request configuration');
    lines.push(' */');
    lines.push('export interface RequestConfig {');
    lines.push('  headers?: Record<string, string>;');
    lines.push('  params?: Record<string, unknown>;');
    lines.push('  timeout?: number;');
    if (this.options.includeCancellation) {
      lines.push('  signal?: AbortSignal;');
    }
    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate client class
   */
  private generateClient(): string {
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(' * Generated API Client');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    // Imports
    lines.push(`import type {`);
    lines.push(`  APIResponse,`);
    lines.push(`  APIErrorResponse,`);
    lines.push(`  PaginatedResponse,`);
    lines.push(`  RequestConfig,`);
    for (const [name] of this.models) {
      lines.push(`  ${modelToInterfaceName(name)},`);
    }
    lines.push(`} from './types';`);
    
    if (this.options.generateErrors) {
      lines.push(`import { APIError, ValidationError, NotFoundError, UnauthorizedError } from './errors';`);
    }
    
    lines.push('');

    // Client class
    if (this.options.includeJSDoc) {
      lines.push(`/**`);
      lines.push(` * Type-safe API client`);
      lines.push(` */`);
    }
    
    lines.push(`export class ${this.options.className} {`);
    lines.push(`  private baseUrl: string;`);
    lines.push(`  private headers: Record<string, string> = {};`);
    
    if (this.options.includeInterceptors) {
      lines.push(`  private requestInterceptors: Array<(config: RequestConfig) => RequestConfig | Promise<RequestConfig>> = [];`);
      lines.push(`  private responseInterceptors: Array<(response: APIResponse) => APIResponse | Promise<APIResponse>> = [];`);
    }
    
    lines.push('');

    // Constructor
    lines.push(`  constructor(baseUrl: string = '${this.options.baseUrl}', defaultHeaders: Record<string, string> = {}) {`);
    lines.push(`    this.baseUrl = baseUrl;`);
    lines.push(`    this.headers = { 'Content-Type': 'application/json', ...defaultHeaders };`);
    lines.push(`  }`);
    lines.push('');

    // Set auth token method
    lines.push(`  /**`);
    lines.push(`   * Set authentication token`);
    lines.push(`   */`);
    lines.push(`  setAuthToken(token: string): void {`);
    lines.push(`    this.headers['Authorization'] = \`Bearer \${token}\`;`);
    lines.push(`  }`);
    lines.push('');

    // Set header method
    lines.push(`  /**`);
    lines.push(`   * Set custom header`);
    lines.push(`   */`);
    lines.push(`  setHeader(key: string, value: string): void {`);
    lines.push(`    this.headers[key] = value;`);
    lines.push(`  }`);
    lines.push('');

    // Interceptor methods
    if (this.options.includeInterceptors) {
      lines.push(`  /**`);
      lines.push(`   * Add request interceptor`);
      lines.push(`   */`);
      lines.push(`  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>): void {`);
      lines.push(`    this.requestInterceptors.push(interceptor);`);
      lines.push(`  }`);
      lines.push('');

      lines.push(`  /**`);
      lines.push(`   * Add response interceptor`);
      lines.push(`   */`);
      lines.push(`  addResponseInterceptor(interceptor: (response: APIResponse) => APIResponse | Promise<APIResponse>): void {`);
      lines.push(`    this.responseInterceptors.push(interceptor);`);
      lines.push(`  }`);
      lines.push('');
    }

    // Request method
    lines.push(`  /**`);
    lines.push(`   * Make HTTP request`);
    lines.push(`   */`);
    lines.push(`  private async request<T>(method: string, path: string, config: RequestConfig = {}): Promise<APIResponse<T>> {`);
    
    if (this.options.includeInterceptors) {
      lines.push(`    // Apply request interceptors`);
      lines.push(`    let finalConfig = config;`);
      lines.push(`    for (const interceptor of this.requestInterceptors) {`);
      lines.push(`      finalConfig = await interceptor(finalConfig);`);
      lines.push(`    }`);
      lines.push('');
    }
    
    lines.push(`    const url = new URL(path, this.baseUrl);`);
    lines.push('');
    lines.push(`    // Add query parameters`);
    lines.push(`    if (${this.options.includeInterceptors ? 'finalConfig' : 'config'}.params) {`);
    lines.push(`      Object.entries(${this.options.includeInterceptors ? 'finalConfig' : 'config'}.params).forEach(([key, value]) => {`);
    lines.push(`        if (value !== undefined && value !== null) {`);
    lines.push(`          url.searchParams.append(key, String(value));`);
    lines.push(`        }`);
    lines.push(`      });`);
    lines.push(`    }`);
    lines.push('');

    lines.push(`    const headers = { ...this.headers, ...${this.options.includeInterceptors ? 'finalConfig' : 'config'}.headers };`);
    lines.push('');

    lines.push(`    const fetchOptions: RequestInit = {`);
    lines.push(`      method,`);
    lines.push(`      headers,`);
    if (this.options.includeCancellation) {
      lines.push(`      signal: ${this.options.includeInterceptors ? 'finalConfig' : 'config'}.signal,`);
    }
    lines.push(`    };`);
    lines.push('');

    lines.push(`    if (${this.options.includeInterceptors ? 'finalConfig' : 'config'}.body) {`);
    lines.push(`      fetchOptions.body = JSON.stringify(this.serialize(${this.options.includeInterceptors ? 'finalConfig' : 'config'}.body));`);
    lines.push(`    }`);
    lines.push('');

    if (this.options.includeRetry) {
      lines.push(`    // Retry logic with exponential backoff`);
      lines.push(`    let lastError: Error | null = null;`);
      lines.push(`    const maxRetries = 3;`);
      lines.push(`    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];`);
      lines.push('');
      lines.push(`    for (let attempt = 0; attempt <= maxRetries; attempt++) {`);
      lines.push(`      try {`);
      lines.push(`        const response = await fetch(url.toString(), fetchOptions);`);
      lines.push('');
      lines.push(`        // Check if we should retry`);
      lines.push(`        if (!response.ok && attempt < maxRetries && retryableStatusCodes.includes(response.status)) {`);
      lines.push(`          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);`);
      lines.push(`          await new Promise(resolve => setTimeout(resolve, delay));`);
      lines.push(`          continue;`);
      lines.push(`        }`);
      lines.push('');
      lines.push(`        const responseHeaders: Record<string, string> = {};`);
      lines.push(`        response.headers.forEach((value, key) => {`);
      lines.push(`          responseHeaders[key] = value;`);
      lines.push(`        });`);
      lines.push('');
      lines.push(`        if (!response.ok) {`);
      lines.push(`          const errorData: APIErrorResponse = await response.json();`);
      if (this.options.generateErrors) {
        lines.push(`          throw this.createError(response.status, errorData);`);
      } else {
        lines.push(`          throw new Error(errorData.error.message);`);
      }
      lines.push(`        }`);
      lines.push('');
      lines.push(`        const data = await response.json();`);
      lines.push(`        const deserializedData = this.deserialize<T>(data);`);
      lines.push(`        let result: APIResponse<T> = { data: deserializedData, status: response.status, headers: responseHeaders };`);
      lines.push('');
      
      if (this.options.includeInterceptors) {
        lines.push(`        // Apply response interceptors`);
        lines.push(`        for (const interceptor of this.responseInterceptors) {`);
        lines.push(`          result = await interceptor(result);`);
        lines.push(`        }`);
        lines.push('');
      }
      
      lines.push(`        return result;`);
      lines.push(`      } catch (error) {`);
      lines.push(`        lastError = error as Error;`);
      lines.push(`        if (attempt === maxRetries) {`);
      lines.push(`          throw error;`);
      lines.push(`        }`);
      lines.push(`      }`);
      lines.push(`    }`);
      lines.push('');
      lines.push(`    throw lastError || new Error('Request failed');`);
    } else {
      lines.push(`    const response = await fetch(url.toString(), fetchOptions);`);
      lines.push('');
      lines.push(`    const responseHeaders: Record<string, string> = {};`);
      lines.push(`    response.headers.forEach((value, key) => {`);
      lines.push(`      responseHeaders[key] = value;`);
      lines.push(`    });`);
      lines.push('');
      lines.push(`    if (!response.ok) {`);
      lines.push(`      const errorData: APIErrorResponse = await response.json();`);
      if (this.options.generateErrors) {
        lines.push(`      throw this.createError(response.status, errorData);`);
      } else {
        lines.push(`      throw new Error(errorData.error.message);`);
      }
      lines.push(`    }`);
      lines.push('');
      lines.push(`    const data = await response.json();`);
      lines.push(`    const deserializedData = this.deserialize<T>(data);`);
      lines.push(`    let result: APIResponse<T> = { data: deserializedData, status: response.status, headers: responseHeaders };`);
      lines.push('');
      
      if (this.options.includeInterceptors) {
        lines.push(`    // Apply response interceptors`);
        lines.push(`    for (const interceptor of this.responseInterceptors) {`);
        lines.push(`      result = await interceptor(result);`);
        lines.push(`    }`);
        lines.push('');
      }
      
      lines.push(`    return result;`);
    }
    
    lines.push(`  }`);
    lines.push('');

    // Serialization/Deserialization methods
    lines.push(`  /**`);
    lines.push(`   * Serialize data before sending (convert Date to ISO string, etc.)`);
    lines.push(`   */`);
    lines.push(`  private serialize(data: unknown): unknown {`);
    lines.push(`    if (data === null || data === undefined) {`);
    lines.push(`      return data;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    if (data instanceof Date) {`);
    lines.push(`      return data.toISOString();`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    if (Array.isArray(data)) {`);
    lines.push(`      return data.map(item => this.serialize(item));`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    if (typeof data === 'object') {`);
    lines.push(`      const serialized: Record<string, unknown> = {};`);
    lines.push(`      for (const [key, value] of Object.entries(data)) {`);
    lines.push(`        serialized[key] = this.serialize(value);`);
    lines.push(`      }`);
    lines.push(`      return serialized;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    return data;`);
    lines.push(`  }`);
    lines.push('');

    lines.push(`  /**`);
    lines.push(`   * Deserialize response data (convert ISO strings to Date, etc.)`);
    lines.push(`   */`);
    lines.push(`  private deserialize<T>(data: unknown): T {`);
    lines.push(`    if (data === null || data === undefined) {`);
    lines.push(`      return data as T;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    if (typeof data === 'string') {`);
    lines.push(`      // Check if string is ISO date format`);
    lines.push(`      const isoDateRegex = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z?$/;`);
    lines.push(`      if (isoDateRegex.test(data)) {`);
    lines.push(`        const date = new Date(data);`);
    lines.push(`        if (!isNaN(date.getTime())) {`);
    lines.push(`          return date as T;`);
    lines.push(`        }`);
    lines.push(`      }`);
    lines.push(`      return data as T;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    if (Array.isArray(data)) {`);
    lines.push(`      return data.map(item => this.deserialize(item)) as T;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    if (typeof data === 'object') {`);
    lines.push(`      const deserialized: Record<string, unknown> = {};`);
    lines.push(`      for (const [key, value] of Object.entries(data)) {`);
    lines.push(`        deserialized[key] = this.deserialize(value);`);
    lines.push(`      }`);
    lines.push(`      return deserialized as T;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    return data as T;`);
    lines.push(`  }`);
    lines.push('');

    // Error creation method
    if (this.options.generateErrors) {
      lines.push(`  /**`);
      lines.push(`   * Create appropriate error based on status code`);
      lines.push(`   */`);
      lines.push(`  private createError(status: number, errorData: APIErrorResponse): Error {`);
      lines.push(`    switch (status) {`);
      lines.push(`      case 400:`);
      lines.push(`        return new ValidationError(errorData.error.message, errorData.error.details);`);
      lines.push(`      case 401:`);
      lines.push(`        return new UnauthorizedError(errorData.error.message);`);
      lines.push(`      case 404:`);
      lines.push(`        return new NotFoundError(errorData.error.message);`);
      lines.push(`      default:`);
      lines.push(`        return new APIError(errorData.error.message, status, errorData.error.code);`);
      lines.push(`    }`);
      lines.push(`  }`);
      lines.push('');
    }

    // Generate methods for each route
    const generatedMethods = new Set<string>();
    
    for (const route of this.routes) {
      const methodName = pathToMethodName(route.path, route.method);
      
      // Skip if we've already generated this method
      if (generatedMethods.has(methodName)) {
        continue;
      }
      generatedMethods.add(methodName);
      
      const pathParams = extractPathParams(route.path);
      const modelName = this.inferModelFromPath(route.path);
      const model = modelName ? this.models.get(modelName) : undefined;
      
      // Generate method
      lines.push(...this.generateMethod(route, methodName, pathParams, model));
      lines.push('');
    }

    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate a client method for a route
   */
  private generateMethod(
    route: RouteDefinition,
    methodName: string,
    pathParams: Array<{ name: string; type: string }>,
    model?: ModelDefinition
  ): string[] {
    const lines: string[] = [];
    
    // JSDoc
    if (this.options.includeJSDoc) {
      const jsdocParams: Array<{ name: string; description?: string }> = [];
      
      for (const param of pathParams) {
        jsdocParams.push({ name: param.name, description: `${capitalize(param.name)} parameter` });
      }
      
      if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
        jsdocParams.push({ name: 'data', description: 'Request body data' });
      }
      
      if (route.method === 'GET' && !route.path.includes(':')) {
        jsdocParams.push({ name: 'params', description: 'Query parameters' });
      }
      
      jsdocParams.push({ name: 'config', description: 'Request configuration' });
      
      const returnType = this.getReturnType(route, model);
      
      lines.push(generateJSDoc(
        route.metadata?.description,
        jsdocParams,
        `Promise with ${returnType}`
      ));
    }
    
    // Method signature
    const params: string[] = [];
    
    for (const param of pathParams) {
      params.push(`${param.name}: ${param.type}`);
    }
    
    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      const dataType = model ? `Partial<${modelToInterfaceName(model.name)}>` : 'unknown';
      params.push(`data: ${dataType}`);
    }
    
    if (route.method === 'GET' && !route.path.includes(':')) {
      params.push(`params?: { page?: number; limit?: number; [key: string]: unknown }`);
    }
    
    params.push(`config: RequestConfig = {}`);
    
    const returnType = this.getReturnType(route, model);
    
    lines.push(`  async ${methodName}(${params.join(', ')}): Promise<${returnType}> {`);
    
    // Build path
    let pathBuilder = `\`${route.path}\``;
    for (const param of pathParams) {
      pathBuilder = pathBuilder.replace(`:${param.name}`, `\${${param.name}}`);
    }
    
    lines.push(`    const path = ${pathBuilder};`);
    
    // Build config
    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      lines.push(`    const response = await this.request<${this.getDataType(route, model)}>('${route.method}', path, { ...config, body: data });`);
    } else if (route.method === 'GET' && !route.path.includes(':')) {
      lines.push(`    const response = await this.request<${this.getDataType(route, model)}>('${route.method}', path, { ...config, params });`);
    } else {
      lines.push(`    const response = await this.request<${this.getDataType(route, model)}>('${route.method}', path, config);`);
    }
    
    lines.push(`    return response.data;`);
    lines.push(`  }`);
    
    return lines;
  }

  /**
   * Get return type for a method
   */
  private getReturnType(route: RouteDefinition, model?: ModelDefinition): string {
    if (route.method === 'DELETE') {
      return 'void';
    }
    
    if (route.method === 'GET' && !route.path.includes(':')) {
      // List endpoint
      if (model) {
        return `PaginatedResponse<${modelToInterfaceName(model.name)}>`;
      }
      return 'PaginatedResponse<unknown>';
    }
    
    if (model) {
      return modelToInterfaceName(model.name);
    }
    
    return 'unknown';
  }

  /**
   * Get data type for response
   */
  private getDataType(route: RouteDefinition, model?: ModelDefinition): string {
    if (route.method === 'GET' && !route.path.includes(':')) {
      // List endpoint
      if (model) {
        return `PaginatedResponse<${modelToInterfaceName(model.name)}>`;
      }
      return 'PaginatedResponse<unknown>';
    }
    
    if (model) {
      return modelToInterfaceName(model.name);
    }
    
    return 'unknown';
  }

  /**
   * Infer model name from route path
   */
  private inferModelFromPath(path: string): string | null {
    const parts = path.split('/').filter(Boolean);
    
    for (const part of parts) {
      if (!part.startsWith(':') && !part.match(/^(api|v\d+)$/i)) {
        const singular = part.endsWith('s') ? part.slice(0, -1) : part;
        return capitalize(singular);
      }
    }
    
    return null;
  }

  /**
   * Generate error classes
   */
  private generateErrors(): string {
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(' * Generated Error Classes');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    lines.push('/**');
    lines.push(' * Base API Error');
    lines.push(' */');
    lines.push('export class APIError extends Error {');
    lines.push('  constructor(');
    lines.push('    message: string,');
    lines.push('    public readonly status: number,');
    lines.push('    public readonly code: string');
    lines.push('  ) {');
    lines.push('    super(message);');
    lines.push('    this.name = "APIError";');
    lines.push('  }');
    lines.push('}');
    lines.push('');

    lines.push('/**');
    lines.push(' * Validation Error (400)');
    lines.push(' */');
    lines.push('export class ValidationError extends APIError {');
    lines.push('  constructor(message: string, public readonly details?: unknown) {');
    lines.push('    super(message, 400, "VALIDATION_ERROR");');
    lines.push('    this.name = "ValidationError";');
    lines.push('  }');
    lines.push('}');
    lines.push('');

    lines.push('/**');
    lines.push(' * Unauthorized Error (401)');
    lines.push(' */');
    lines.push('export class UnauthorizedError extends APIError {');
    lines.push('  constructor(message: string) {');
    lines.push('    super(message, 401, "UNAUTHORIZED");');
    lines.push('    this.name = "UnauthorizedError";');
    lines.push('  }');
    lines.push('}');
    lines.push('');

    lines.push('/**');
    lines.push(' * Not Found Error (404)');
    lines.push(' */');
    lines.push('export class NotFoundError extends APIError {');
    lines.push('  constructor(message: string) {');
    lines.push('    super(message, 404, "NOT_FOUND");');
    lines.push('    this.name = "NotFoundError";');
    lines.push('  }');
    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate utility functions
   */
  private generateUtils(): string {
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(' * Generated Utility Functions');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    lines.push('/**');
    lines.push(' * Build query string from parameters');
    lines.push(' */');
    lines.push('export function buildQueryString(params: Record<string, unknown>): string {');
    lines.push('  return new URLSearchParams(');
    lines.push('    Object.entries(params)');
    lines.push('      .filter(([_, value]) => value !== undefined && value !== null)');
    lines.push('      .map(([key, value]) => [key, String(value)])');
    lines.push('  ).toString();');
    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate all files and write to directory
   */
  generateToFiles(): Map<string, string> {
    const files = new Map<string, string>();
    const generated = this.generate();
    
    files.set('types.ts', generated.types);
    files.set('client.ts', generated.client);
    
    if (generated.errors) {
      files.set('errors.ts', generated.errors);
    }
    
    if (generated.utils) {
      files.set('utils.ts', generated.utils);
    }
    
    // Generate index file
    const indexLines: string[] = [];
    indexLines.push('/**');
    indexLines.push(' * Generated API Client');
    indexLines.push(' * ');
    indexLines.push(' * DO NOT EDIT - This file is auto-generated');
    indexLines.push(' */');
    indexLines.push('');
    indexLines.push(`export * from './types';`);
    indexLines.push(`export * from './client';`);
    if (generated.errors) {
      indexLines.push(`export * from './errors';`);
    }
    indexLines.push(`export * from './utils';`);
    indexLines.push('');
    
    files.set('index.ts', indexLines.join('\n'));
    
    return files;
  }
}
