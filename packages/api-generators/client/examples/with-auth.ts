/**
 * Authentication Example
 *
 * Demonstrates client usage with authentication
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
      { name: 'name', type: 'string', required: true },
    ],
  },
];

// Define routes including auth endpoints
const routes: RouteDefinition[] = [
  { path: '/auth/login', method: 'POST', metadata: { description: 'Login' } },
  { path: '/auth/logout', method: 'POST', metadata: { description: 'Logout' } },
  { path: '/auth/me', method: 'GET', metadata: { description: 'Get current user' } },
  { path: '/users', method: 'GET', metadata: { description: 'List users (protected)' } },
];

// Create generator
const generator = new ClientGenerator({
  className: 'APIClient',
  baseUrl: 'https://api.example.com',
  generateErrors: true,
});

generator.registerModels(models);
generator.registerRoutes(routes);

const files = generator.generateToFiles();

console.log('Generated authenticated client');

// Example usage with authentication:
/*
import { APIClient, UnauthorizedError } from './generated';

const client = new APIClient('https://api.example.com');

// Login and get token
const loginResponse = await client.createAuthLogin({
  email: 'user@example.com',
  password: 'password123',
});

// Set authentication token
client.setAuthToken(loginResponse.token);

// Now all requests will include the Authorization header
const currentUser = await client.getAuthMe();
console.log('Logged in as:', currentUser.name);

// Make authenticated requests
const users = await client.getUsers();
console.log('Users:', users);

// Handle authentication errors
try {
  const protectedData = await client.getUsers();
} catch (error) {
  if (error instanceof UnauthorizedError) {
    console.log('Please login first');
    // Redirect to login page
  }
}

// Logout
await client.createAuthLogout();

// Custom headers for API key authentication
client.setHeader('X-API-Key', 'your-api-key');

// Or set multiple headers
const apiClient = new APIClient('https://api.example.com', {
  'X-API-Key': 'your-api-key',
  'X-Client-Version': '1.0.0',
});
*/
