/**
 * Core Runtime Usage Example
 * 
 * Demonstrates how to initialize and use the CoreRuntime for bootstrapping
 * a Web Loom API application.
 */

import { CoreRuntime, defineConfig } from '@web-loom/api-core';

// Define configuration
const config = defineConfig({
  adapters: {
    api: {
      package: '@web-loom/api-adapter-hono',
      options: {
        compression: true,
        poweredBy: false,
      },
    },
    database: {
      package: '@web-loom/api-adapter-drizzle',
      options: {
        logger: true,
      },
    },
    validation: {
      package: '@web-loom/api-adapter-zod',
      options: {},
    },
    auth: {
      package: '@web-loom/api-adapter-lucia',
      options: {
        sessionExpiresIn: '7d',
      },
    },
  },
  database: {
    url: '${DATABASE_URL}',
    poolSize: 10,
    connectionTimeout: 10000,
    ssl: true,
  },
  security: {
    cors: {
      origins: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      headers: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    },
    rateLimit: {
      limit: 100,
      window: '1m',
    },
    requestSizeLimit: 1048576, // 1 MB
  },
  features: {
    crud: true,
    caching: true,
    auditLogging: true,
  },
  observability: {
    logging: {
      level: 'info',
      format: 'json',
      redact: ['password', 'token', 'apiKey'],
    },
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      collectDefault: true,
    },
  },
  development: {
    hotReload: true,
    apiDocs: true,
    detailedErrors: true,
  },
});

// Example 1: Basic initialization and startup
async function basicExample() {
  console.log('=== Basic Example ===\n');

  // Create runtime instance
  const runtime = new CoreRuntime();

  try {
    // Initialize with configuration
    console.log('Initializing runtime...');
    await runtime.initialize(config);
    console.log(`✓ Runtime initialized (state: ${runtime.getState()})\n`);

    // Start the application
    console.log('Starting application...');
    await runtime.start();
    console.log(`✓ Application started (state: ${runtime.getState()})`);
    console.log(`✓ Ready to handle requests: ${runtime.isReady()}\n`);

    // Access registries
    const modelRegistry = runtime.getModelRegistry();
    const routeRegistry = runtime.getRouteRegistry();
    console.log(`Models registered: ${modelRegistry.getAll().length}`);
    console.log(`Routes registered: ${routeRegistry.getAll().length}\n`);

    // Graceful shutdown
    console.log('Shutting down...');
    await runtime.shutdown(5000);
    console.log(`✓ Shutdown complete (state: ${runtime.getState()})\n`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

// Example 2: Accessing adapters
async function adapterExample() {
  console.log('=== Adapter Example ===\n');

  const runtime = new CoreRuntime();

  try {
    await runtime.initialize(config);

    // Access critical adapters (initialized during startup)
    console.log('Accessing critical adapters:');
    const apiAdapter = runtime.getAdapter('api');
    console.log('✓ API adapter:', typeof apiAdapter);

    const dbAdapter = runtime.getAdapter('database');
    console.log('✓ Database adapter:', typeof dbAdapter);

    const validationAdapter = runtime.getAdapter('validation');
    console.log('✓ Validation adapter:', typeof validationAdapter);

    // Access lazy-loaded adapters (initialized on first use)
    console.log('\nAccessing lazy-loaded adapters:');
    const authAdapter = runtime.getAdapter('auth');
    console.log('✓ Auth adapter:', typeof authAdapter);

    await runtime.shutdown();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

// Example 3: Working with registries
async function registryExample() {
  console.log('=== Registry Example ===\n');

  const runtime = new CoreRuntime();

  try {
    await runtime.initialize(config);

    // Access model registry
    const modelRegistry = runtime.getModelRegistry();
    console.log('Model Registry:');
    console.log(`- Total models: ${modelRegistry.getAll().length}`);

    // Register a model (example)
    modelRegistry.register({
      name: 'User',
      tableName: 'users',
      fields: [
        {
          name: 'id',
          type: 'uuid',
          database: { primaryKey: true },
        },
        {
          name: 'email',
          type: 'string',
          validation: { required: true, email: true },
          database: { unique: true },
        },
        {
          name: 'name',
          type: 'string',
          validation: { required: true },
        },
      ],
      options: {
        timestamps: true,
        crud: true,
      },
    });

    console.log(`- After registration: ${modelRegistry.getAll().length} models`);
    console.log(`- User model exists: ${modelRegistry.has('User')}\n`);

    // Access route registry
    const routeRegistry = runtime.getRouteRegistry();
    console.log('Route Registry:');
    console.log(`- Total routes: ${routeRegistry.getAll().length}`);

    // Register a route (example)
    routeRegistry.register({
      path: '/health',
      method: 'GET',
      handler: async () => new Response(JSON.stringify({ status: 'ok' })),
      metadata: {
        description: 'Health check endpoint',
        tags: ['system'],
      },
    });

    console.log(`- After registration: ${routeRegistry.getAll().length} routes`);
    console.log(`- Health route exists: ${routeRegistry.has('/health', 'GET')}\n`);

    await runtime.shutdown();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

// Example 4: Error handling
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===\n');

  const runtime = new CoreRuntime();

  try {
    // Try to start before initialization
    console.log('Attempting to start before initialization...');
    await runtime.start();
  } catch (error) {
    console.log('✓ Caught expected error:', error instanceof Error ? error.message : error);
  }

  try {
    // Initialize with invalid config
    console.log('\nAttempting to initialize with invalid config...');
    await runtime.initialize({} as any);
  } catch (error) {
    console.log('✓ Caught expected error:', error instanceof Error ? error.message : error);
  }

  try {
    // Access adapter before initialization
    console.log('\nAttempting to access adapter before initialization...');
    runtime.getAdapter('database');
  } catch (error) {
    console.log('✓ Caught expected error:', error instanceof Error ? error.message : error);
  }

  console.log();
}

// Example 5: Lifecycle management
async function lifecycleExample() {
  console.log('=== Lifecycle Example ===\n');

  const runtime = new CoreRuntime();

  console.log(`Initial state: ${runtime.getState()}`);
  console.log(`Is ready: ${runtime.isReady()}\n`);

  await runtime.initialize(config);
  console.log(`After initialization: ${runtime.getState()}`);
  console.log(`Is ready: ${runtime.isReady()}\n`);

  await runtime.start();
  console.log(`After start: ${runtime.getState()}`);
  console.log(`Is ready: ${runtime.isReady()}\n`);

  await runtime.shutdown();
  console.log(`After shutdown: ${runtime.getState()}`);
  console.log(`Is ready: ${runtime.isReady()}\n`);
}

// Run examples
async function main() {
  console.log('Core Runtime Examples\n');
  console.log('='.repeat(50));
  console.log();

  await basicExample();
  await adapterExample();
  await registryExample();
  await errorHandlingExample();
  await lifecycleExample();

  console.log('='.repeat(50));
  console.log('\nAll examples completed!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicExample,
  adapterExample,
  registryExample,
  errorHandlingExample,
  lifecycleExample,
};
