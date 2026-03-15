/**
 * Route Discovery Example
 * 
 * This example demonstrates how to use the RouteDiscovery class to automatically
 * discover and register routes from a file-based routing structure.
 */

import { RouteRegistry, RouteDiscovery } from '../src/registry';

async function main() {
  console.log('=== Route Discovery Example ===\n');

  // Create a route registry
  const registry = new RouteRegistry();
  console.log('✓ Created RouteRegistry');

  // Create a route discovery instance
  const discovery = new RouteDiscovery(registry);
  console.log('✓ Created RouteDiscovery\n');

  // Example: Discover routes from a directory
  // In a real application, you would point this to your actual routes directory
  console.log('Example route structure:');
  console.log('src/routes/');
  console.log('├── index.ts              → GET /');
  console.log('├── users.ts              → GET /users, POST /users');
  console.log('├── users/');
  console.log('│   ├── [id].ts          → GET /users/:id, PUT /users/:id, DELETE /users/:id');
  console.log('│   └── [id]/');
  console.log('│       └── posts.ts     → GET /users/:id/posts');
  console.log('└── [...path].ts         → GET /* (catch-all)\n');

  // Note: In this example, we're not actually calling discover() because
  // we don't have a real routes directory set up. In a real application:
  // await discovery.discover('./src/routes');

  // Simulate what would happen after discovery
  console.log('After discovery, you can:');
  console.log('1. Get statistics about discovered routes');
  console.log('2. Match incoming requests to routes');
  console.log('3. Access route metadata\n');

  // Example: Get statistics
  console.log('=== Route Statistics ===');
  const stats = discovery.getStats();
  console.log(`Total routes: ${stats.totalRoutes}`);
  console.log(`Routes by method:`);
  console.log(`  GET:     ${stats.routesByMethod.GET}`);
  console.log(`  POST:    ${stats.routesByMethod.POST}`);
  console.log(`  PUT:     ${stats.routesByMethod.PUT}`);
  console.log(`  PATCH:   ${stats.routesByMethod.PATCH}`);
  console.log(`  DELETE:  ${stats.routesByMethod.DELETE}`);
  console.log(`  OPTIONS: ${stats.routesByMethod.OPTIONS}`);
  console.log(`  HEAD:    ${stats.routesByMethod.HEAD}\n`);

  // Example: File path to URL path mapping
  console.log('=== File Path to URL Path Mapping ===');
  const mappings = [
    { file: 'index.ts', url: '/' },
    { file: 'users.ts', url: '/users' },
    { file: 'users/[id].ts', url: '/users/:id' },
    { file: 'users/[id]/posts.ts', url: '/users/:id/posts' },
    { file: 'users/[id]/posts/[postId].ts', url: '/users/:id/posts/:postId' },
    { file: '[...path].ts', url: '/*' },
    { file: 'api/v1/users/[id].ts', url: '/api/v1/users/:id' },
  ];

  console.log('File Path                        → URL Path');
  console.log('─'.repeat(60));
  for (const { file, url } of mappings) {
    console.log(`${file.padEnd(32)} → ${url}`);
  }
  console.log();

  // Example: Route file structure
  console.log('=== Example Route File ===');
  console.log('// src/routes/users/[id].ts\n');
  console.log('// GET /users/:id - Get user by ID');
  console.log('export async function GET(ctx) {');
  console.log('  const { id } = ctx.params;');
  console.log('  const user = await db.users.findUnique({ where: { id } });');
  console.log('  return new Response(JSON.stringify(user));');
  console.log('}\n');
  console.log('// PUT /users/:id - Update user');
  console.log('export async function PUT(ctx) {');
  console.log('  const { id } = ctx.params;');
  console.log('  const data = await ctx.request.json();');
  console.log('  const user = await db.users.update({ where: { id }, data });');
  console.log('  return new Response(JSON.stringify(user));');
  console.log('}\n');
  console.log('// DELETE /users/:id - Delete user');
  console.log('export async function DELETE(ctx) {');
  console.log('  const { id } = ctx.params;');
  console.log('  await db.users.delete({ where: { id } });');
  console.log('  return new Response(null, { status: 204 });');
  console.log('}\n');

  // Example: Integration with Core Runtime
  console.log('=== Integration with Core Runtime ===');
  console.log('class CoreRuntime {');
  console.log('  async initialize() {');
  console.log('    // Initialize registries');
  console.log('    this.routeRegistry = new RouteRegistry();');
  console.log('    this.routeDiscovery = new RouteDiscovery(this.routeRegistry);');
  console.log('');
  console.log('    // Discover routes from file system');
  console.log('    await this.routeDiscovery.discover(\'./src/routes\');');
  console.log('');
  console.log('    // Routes are now registered and ready to use');
  console.log('    const stats = this.routeDiscovery.getStats();');
  console.log('    console.log(`Initialized with ${stats.totalRoutes} routes`);');
  console.log('  }');
  console.log('}\n');

  console.log('=== Key Features ===');
  console.log('✓ Automatic route discovery from file system');
  console.log('✓ File-based routing with Next.js-style conventions');
  console.log('✓ Dynamic segments: [id] → :id');
  console.log('✓ Catch-all routes: [...path] → *');
  console.log('✓ Nested routes from directory structure');
  console.log('✓ Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)');
  console.log('✓ Automatic filtering of test files and type definitions');
  console.log('✓ Detailed error messages with file context');
  console.log('✓ Statistics about discovered routes\n');

  console.log('=== Best Practices ===');
  console.log('1. Organize routes by resource (users/, posts/, etc.)');
  console.log('2. Use index.ts for collection endpoints');
  console.log('3. Use [param].ts for dynamic segments');
  console.log('4. Keep route files focused on a single resource');
  console.log('5. Handle errors gracefully in route handlers');
  console.log('6. Use descriptive directory and file names\n');
}

// Run the example
main().catch(console.error);
