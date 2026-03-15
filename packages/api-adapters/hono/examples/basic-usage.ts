/**
 * Basic Usage Example for @web-loom/api-adapter-hono
 * 
 * This example demonstrates the core features of the Hono adapter:
 * - Route registration for different HTTP methods
 * - Path and query parameter handling
 * - Request body parsing
 * - Middleware usage
 * - Server lifecycle management
 */

import { HonoAdapter } from '../src';

async function main() {
  const adapter = new HonoAdapter();

  // ============================================================================
  // Middleware
  // ============================================================================

  // Global logging middleware
  adapter.registerMiddleware(async (ctx, next) => {
    const start = Date.now();
    console.log(`→ ${ctx.request.method} ${ctx.request.url}`);
    
    const response = await next();
    
    const duration = Date.now() - start;
    console.log(`← ${response.status} (${duration}ms)`);
    
    return response;
  });

  // Authentication middleware for /admin routes
  adapter.registerMiddleware(
    async (ctx, next) => {
      const token = ctx.request.headers.get('Authorization');
      
      if (!token || token !== 'Bearer secret-token') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      // Set user in context
      ctx.metadata.set('user', { id: '123', role: 'admin' });
      
      return await next();
    },
    { path: '/admin/*' }
  );

  // ============================================================================
  // Routes
  // ============================================================================

  // Simple GET route
  adapter.registerRoute('GET', '/', async (ctx) => {
    return new Response(
      JSON.stringify({
        message: 'Welcome to Web Loom API',
        version: '1.0.0',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // GET with path parameter
  adapter.registerRoute('GET', '/users/:id', async (ctx) => {
    const userId = ctx.params.id;
    
    return new Response(
      JSON.stringify({
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // GET with query parameters
  adapter.registerRoute('GET', '/search', async (ctx) => {
    const { q, page = '1', limit = '10' } = ctx.query;
    
    return new Response(
      JSON.stringify({
        query: q,
        page: parseInt(page),
        limit: parseInt(limit),
        results: [
          { id: '1', title: 'Result 1' },
          { id: '2', title: 'Result 2' },
        ],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // POST with JSON body
  adapter.registerRoute('POST', '/users', async (ctx) => {
    const userData = ctx.body as { name: string; email: string };
    
    // Simulate creating a user
    const newUser = {
      id: Math.random().toString(36).substring(7),
      ...userData,
      createdAt: new Date().toISOString(),
    };
    
    return new Response(JSON.stringify(newUser), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  // PUT with path parameter and body
  adapter.registerRoute('PUT', '/users/:id', async (ctx) => {
    const userId = ctx.params.id;
    const updates = ctx.body as { name?: string; email?: string };
    
    return new Response(
      JSON.stringify({
        id: userId,
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // PATCH for partial updates
  adapter.registerRoute('PATCH', '/users/:id', async (ctx) => {
    const userId = ctx.params.id;
    const updates = ctx.body as Record<string, unknown>;
    
    return new Response(
      JSON.stringify({
        id: userId,
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // DELETE route
  adapter.registerRoute('DELETE', '/users/:id', async (ctx) => {
    const userId = ctx.params.id;
    
    return new Response(null, {
      status: 204,
    });
  });

  // Protected admin route
  adapter.registerRoute('GET', '/admin/stats', async (ctx) => {
    const user = ctx.metadata.get('user') as { id: string; role: string };
    
    return new Response(
      JSON.stringify({
        message: 'Admin statistics',
        user,
        stats: {
          totalUsers: 1234,
          activeUsers: 567,
          totalPosts: 8901,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // Multiple path parameters
  adapter.registerRoute('GET', '/users/:userId/posts/:postId', async (ctx) => {
    const { userId, postId } = ctx.params;
    
    return new Response(
      JSON.stringify({
        userId,
        postId,
        title: 'Sample Post',
        content: 'This is a sample post content.',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // Error handling example
  adapter.registerRoute('GET', '/error', async (ctx) => {
    throw new Error('This is a test error');
  });

  // ============================================================================
  // Start Server
  // ============================================================================

  const port = 3000;
  await adapter.listen(port);
  
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  console.log('\nAvailable routes:');
  console.log('  GET    /');
  console.log('  GET    /users/:id');
  console.log('  GET    /search?q=query&page=1&limit=10');
  console.log('  POST   /users');
  console.log('  PUT    /users/:id');
  console.log('  PATCH  /users/:id');
  console.log('  DELETE /users/:id');
  console.log('  GET    /admin/stats (requires Authorization header)');
  console.log('  GET    /users/:userId/posts/:postId');
  console.log('  GET    /error (test error handling)');
  console.log('\nPress Ctrl+C to stop\n');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await adapter.close();
    console.log('Server closed');
    process.exit(0);
  });
}

// Run the example
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
