/**
 * Interceptors Example
 *
 * Demonstrates request/response interceptors for logging, auth refresh, etc.
 */

import { ClientGenerator } from '../src/client-generator';
import type { ModelDefinition, RouteDefinition } from '../src/types';

// Define models
const models: ModelDefinition[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true },
    ],
  },
];

// Define routes
const routes: RouteDefinition[] = [
  { path: '/users', method: 'GET' },
  { path: '/users/:id', method: 'GET' },
];

// Create generator
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
  includeInterceptors: true,
  generateErrors: true,
});

generator.registerModels(models);
generator.registerRoutes(routes);

const files = generator.generateToFiles();

console.log('Generated client with interceptor support');

// Example usage with interceptors:
/*
import { APIClient, UnauthorizedError } from './generated';

const client = new APIClient('https://api.example.com');

// Add request interceptor for logging
client.addRequestInterceptor((config) => {
  console.log(`[Request] ${config.method} ${config.url}`);
  console.log('[Headers]', config.headers);
  return config;
});

// Add request interceptor for adding timestamps
client.addRequestInterceptor((config) => {
  config.headers = {
    ...config.headers,
    'X-Request-Time': new Date().toISOString(),
  };
  return config;
});

// Add request interceptor for authentication token refresh
client.addRequestInterceptor(async (config) => {
  // Check if token is expired
  const token = localStorage.getItem('auth_token');
  const tokenExpiry = localStorage.getItem('token_expiry');
  
  if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
    // Token expired, refresh it
    const refreshToken = localStorage.getItem('refresh_token');
    const response = await fetch('https://api.example.com/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    const { token: newToken, expiresIn } = await response.json();
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('token_expiry', String(Date.now() + expiresIn * 1000));
    
    // Update config with new token
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${newToken}`,
    };
  } else if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
    };
  }
  
  return config;
});

// Add response interceptor for logging
client.addResponseInterceptor((response) => {
  console.log(`[Response] ${response.status}`);
  console.log('[Data]', response.data);
  return response;
});

// Add response interceptor for caching
const cache = new Map();

client.addResponseInterceptor((response) => {
  // Cache GET requests
  if (response.config?.method === 'GET') {
    const cacheKey = response.config.url;
    cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
    });
  }
  return response;
});

// Add response interceptor for error handling
client.addResponseInterceptor(async (response) => {
  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers['retry-after'];
    console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
    // Retry the request (implementation depends on your needs)
  }
  
  return response;
});

// Add response interceptor for analytics
client.addResponseInterceptor((response) => {
  // Track API usage
  const duration = Date.now() - response.requestStartTime;
  
  analytics.track('api_request', {
    method: response.config?.method,
    path: response.config?.url,
    status: response.status,
    duration,
  });
  
  return response;
});

// Make requests - all interceptors will be applied
const users = await client.getUsers();
const user = await client.getUserById('user-id');

// Interceptors are applied in order:
// 1. Request interceptors (in order added)
// 2. Actual HTTP request
// 3. Response interceptors (in order added)
*/
