/**
 * Middleware Example for @web-loom/api-adapter-hono
 * 
 * This example demonstrates the built-in middleware features:
 * - CORS middleware configuration
 * - Compression middleware
 * - Logging middleware
 * - Custom middleware integration
 */

import { HonoAdapter } from '../src';

async function main() {
  // Create adapter with built-in middleware enabled
  const adapter = new HonoAdapter({
    // CORS middleware - handles cross-origin requests
    cors: {
      enabled: true,
      origin: '*', // Allow all origins (use specific origins in production)
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposeHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 3600, // Cache preflight requests for 1 hour
    },
    
    // Compression middleware - compresses responses
    compression: {
      enabled: true,
    },
    
    // Logging middleware - logs all requests
    logging: {
      enabled: true,
      fn: (message) => {
        // Custom log format with timestamp
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
      },
    },
  });

  // ============================================================================
  // Custom Middleware
  // ============================================================================

  // Request ID middleware - adds unique ID to each request
  adapter.registerMiddleware(async (ctx, next) => {
    const requestId = Math.random().toString(36).substring(7);
    ctx.metadata.set('requestId', requestId);
    
    const response = await next();
    
    // Add request ID to response headers
    response.headers.set('X-Request-Id', requestId);
    
    return response;
  });

  // Authentication middleware - validates Bearer tokens
  adapter.registerMiddleware(async (ctx, next) => {
    const authHeader = ctx.request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Simulate token validation
      if (token === 'valid-token') {
        ctx.user = {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
        };
        ctx.metadata.set('authenticated', true);
      }
    }
    
    return await next();
  });

  // Protected route middleware - requires authentication
  adapter.registerMiddleware(
    async (ctx, next) => {
      if (!ctx.user) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: 'Authentication required',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return await next();
    },
    { path: '/api/protected/*' }
  );

  // Rate limiting middleware (simple example)
  const requestCounts = new Map<string, { count: number; resetAt: number }>();
  
  adapter.registerMiddleware(async (ctx, next) => {
    const ip = ctx.request.headers.get('X-Forwarded-For') || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;
    
    let record = requestCounts.get(ip);
    
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      requestCounts.set(ip, record);
    }
    
    record.count++;
    
    if (record.count > maxRequests) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((record.resetAt - now) / 1000)),
          },
        }
      );
    }
    
    return await next();
  });

  // ============================================================================
  // Routes
  // ============================================================================

  // Public endpoint - demonstrates CORS and compression
  adapter.registerRoute('GET', '/api/public/data', async (ctx) => {
    // Generate large response to demonstrate compression
    const largeData = {
      message: 'This is a large response that will be compressed',
      data: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      })),
      metadata: {
        requestId: ctx.metadata.get('requestId'),
        timestamp: new Date().toISOString(),
      },
    };
    
    return new Response(JSON.stringify(largeData), {
      headers: {
        'Content-Type': 'application/json',
        'X-Total-Count': '100',
      },
    });
  });

  // Protected endpoint - requires authentication
  adapter.registerRoute('GET', '/api/protected/profile', async (ctx) => {
    return new Response(
      JSON.stringify({
        user: ctx.user,
        message: 'This is a protected endpoint',
        requestId: ctx.metadata.get('requestId'),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // CORS preflight test endpoint
  adapter.registerRoute('POST', '/api/cors-test', async (ctx) => {
    return new Response(
      JSON.stringify({
        message: 'CORS is working correctly',
        origin: ctx.request.headers.get('Origin'),
        method: ctx.request.method,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // Health check endpoint
  adapter.registerRoute('GET', '/health', async (ctx) => {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        requestId: ctx.metadata.get('requestId'),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  // ============================================================================
  // Start Server
  // ============================================================================

  const port = 3000;
  await adapter.listen(port);
  
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  console.log('\n📦 Built-in Middleware Enabled:');
  console.log('  ✓ CORS (origin: *, credentials: true)');
  console.log('  ✓ Compression (gzip/deflate/brotli)');
  console.log('  ✓ Logging (custom format with timestamps)');
  console.log('\n🔧 Custom Middleware Active:');
  console.log('  ✓ Request ID generation');
  console.log('  ✓ Authentication (Bearer token)');
  console.log('  ✓ Protected routes (/api/protected/*)');
  console.log('  ✓ Rate limiting (100 req/min)');
  console.log('\n📍 Available Endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api/public/data (large response, will be compressed)');
  console.log('  POST /api/cors-test (test CORS headers)');
  console.log('  GET  /api/protected/profile (requires: Authorization: Bearer valid-token)');
  console.log('\n💡 Try these commands:');
  console.log('  # Test public endpoint');
  console.log('  curl http://localhost:3000/api/public/data');
  console.log('');
  console.log('  # Test CORS with preflight');
  console.log('  curl -X OPTIONS http://localhost:3000/api/cors-test \\');
  console.log('    -H "Origin: http://example.com" \\');
  console.log('    -H "Access-Control-Request-Method: POST"');
  console.log('');
  console.log('  # Test protected endpoint (will fail without token)');
  console.log('  curl http://localhost:3000/api/protected/profile');
  console.log('');
  console.log('  # Test protected endpoint (with valid token)');
  console.log('  curl http://localhost:3000/api/protected/profile \\');
  console.log('    -H "Authorization: Bearer valid-token"');
  console.log('');
  console.log('  # Test compression (check Content-Encoding header)');
  console.log('  curl -H "Accept-Encoding: gzip" -i http://localhost:3000/api/public/data');
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
