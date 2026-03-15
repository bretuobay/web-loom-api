/**
 * OpenAPI 3.1 Type Definitions
 */

/**
 * OpenAPI 3.1 Specification
 */
export interface OpenAPISpec {
  openapi: '3.1.0';
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: OpenAPIPaths;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocs;
}

/**
 * API Information
 */
export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: OpenAPIContact;
  license?: OpenAPILicense;
}

/**
 * Contact Information
 */
export interface OpenAPIContact {
  name?: string;
  url?: string;
  email?: string;
}

/**
 * License Information
 */
export interface OpenAPILicense {
  name: string;
  url?: string;
}

/**
 * Server Information
 */
export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, OpenAPIServerVariable>;
}

/**
 * Server Variable
 */
export interface OpenAPIServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

/**
 * Paths Object
 */
export type OpenAPIPaths = Record<string, OpenAPIPathItem>;

/**
 * Path Item
 */
export interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

/**
 * Operation Object
 */
export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: OpenAPIResponses;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
}

/**
 * Parameter Object
 */
export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema: OpenAPISchema;
  example?: unknown;
}

/**
 * Request Body Object
 */
export interface OpenAPIRequestBody {
  description?: string;
  content: Record<string, OpenAPIMediaType>;
  required?: boolean;
}

/**
 * Media Type Object
 */
export interface OpenAPIMediaType {
  schema: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}

/**
 * Example Object
 */
export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

/**
 * Responses Object
 */
export type OpenAPIResponses = Record<string, OpenAPIResponse>;

/**
 * Response Object
 */
export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, OpenAPIHeader>;
  content?: Record<string, OpenAPIMediaType>;
}

/**
 * Header Object
 */
export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema: OpenAPISchema;
}

/**
 * Components Object
 */
export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

/**
 * Schema Object (JSON Schema)
 */
export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  
  // Number validation
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  
  // String validation
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  
  // Array validation
  items?: OpenAPISchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  
  // Object validation
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  additionalProperties?: boolean | OpenAPISchema;
  minProperties?: number;
  maxProperties?: number;
  
  // Composition
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  
  // Reference
  $ref?: string;
  
  // Metadata
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  example?: unknown;
  examples?: unknown[];
}

/**
 * Security Scheme Object
 */
export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OpenAPIOAuthFlows;
  openIdConnectUrl?: string;
}

/**
 * OAuth Flows Object
 */
export interface OpenAPIOAuthFlows {
  implicit?: OpenAPIOAuthFlow;
  password?: OpenAPIOAuthFlow;
  clientCredentials?: OpenAPIOAuthFlow;
  authorizationCode?: OpenAPIOAuthFlow;
}

/**
 * OAuth Flow Object
 */
export interface OpenAPIOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * Security Requirement Object
 */
export type OpenAPISecurityRequirement = Record<string, string[]>;

/**
 * Tag Object
 */
export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocs;
}

/**
 * External Documentation Object
 */
export interface OpenAPIExternalDocs {
  description?: string;
  url: string;
}

/**
 * OpenAPI Generator Options
 */
export interface OpenAPIGeneratorOptions {
  /** API title */
  title?: string;
  
  /** API version */
  version?: string;
  
  /** API description */
  description?: string;
  
  /** Server URLs */
  servers?: OpenAPIServer[];
  
  /** Contact information */
  contact?: OpenAPIContact;
  
  /** License information */
  license?: OpenAPILicense;
  
  /** Security schemes */
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  
  /** Global security requirements */
  security?: OpenAPISecurityRequirement[];
  
  /** Tags for grouping operations */
  tags?: OpenAPITag[];
  
  /** External documentation */
  externalDocs?: OpenAPIExternalDocs;
  
  /** Include examples in schemas */
  includeExamples?: boolean;
  
  /** Include deprecated routes */
  includeDeprecated?: boolean;
}
