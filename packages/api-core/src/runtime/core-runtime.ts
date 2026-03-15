/**
 * Core Runtime
 * 
 * The bootstrapping engine responsible for initializing the Web Loom API application.
 * Manages the complete application lifecycle from configuration loading through
 * graceful shutdown.
 * 
 * **Initialization Sequence:**
 * 1. Configuration Loading (5-10ms): Load and validate webloom.config.ts
 * 2. Critical Adapter Initialization (20-40ms): Initialize API framework and database adapters
 * 3. Route Discovery (10-20ms): Scan and register route files from src/routes
 * 4. Model Discovery (10-20ms): Scan and register model definitions from src/models
 * 5. CRUD Generation (10-20ms): Generate CRUD routes for registered models (deferred to Task 7.3)
 * 6. Lazy Adapter Loading (deferred): Initialize non-critical adapters on first use (Task 7.2)
 * 7. Middleware Registration (5-10ms): Register global and route-specific middleware (Task 7.4)
 * 8. Ready State (total: 60-100ms): Application ready to handle requests
 * 
 * **Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 * 
 * @example
 * ```typescript
 * import { CoreRuntime } from '@web-loom/api-core';
 * import config from './webloom.config';
 * 
 * const runtime = new CoreRuntime();
 * await runtime.initialize(config);
 * await runtime.start();
 * 
 * // Later, during shutdown
 * await runtime.shutdown(5000);
 * ```
 */

import type { WebLoomConfig } from '../config/types';
import { loadConfigSync } from '../config/load-config';
import { ModelRegistry } from '../registry/model-registry';
import { RouteRegistry } from '../registry/route-registry';
import { RouteDiscovery } from '../registry/route-discovery';
import type {
  APIFrameworkAdapter,
  DatabaseAdapter,
  ValidationAdapter,
  AuthAdapter,
  EmailAdapter,
} from '../interfaces';

/**
 * Adapter type identifiers
 */
export type AdapterType = 'api' | 'database' | 'validation' | 'auth' | 'email';

/**
 * Runtime state
 */
type RuntimeState = 'uninitialized' | 'initializing' | 'ready' | 'starting' | 'running' | 'shutting_down' | 'stopped';

/**
 * Core Runtime class
 * 
 * Singleton pattern for global runtime instance.
 * Manages application lifecycle and provides access to registries and adapters.
 */
export class CoreRuntime {
  private state: RuntimeState = 'uninitialized';
  private config: WebLoomConfig | null = null;
  
  // Registries
  private modelRegistry: ModelRegistry = new ModelRegistry();
  private routeRegistry: RouteRegistry = new RouteRegistry();
  
  // Route discovery
  private routeDiscovery: RouteDiscovery = new RouteDiscovery(this.routeRegistry);
  
  // Adapters (initialized during startup)
  private adapters: Map<AdapterType, unknown> = new Map();
  
  // Lazy-loaded adapters (initialized on first use)
  private lazyAdapters: Set<AdapterType> = new Set(['auth', 'email']);
  
  // Shutdown handlers
  private shutdownHandlers: Array<() => Promise<void>> = [];

  /**
   * Initialize the runtime with configuration
   * 
   * Loads configuration, validates it, and initializes critical adapters.
   * This method must be called before start().
   * 
   * @param config - Web Loom configuration
   * @throws {Error} If already initialized or initialization fails
   * 
   * @example
   * ```typescript
   * await runtime.initialize(config);
   * ```
   */
  async initialize(config: WebLoomConfig): Promise<void> {
    if (this.state !== 'uninitialized') {
      throw new Error(`Cannot initialize runtime in state: ${this.state}`);
    }

    this.state = 'initializing';

    try {
      // Step 1: Load and validate configuration (5-10ms)
      this.config = loadConfigSync(config);

      // Step 2: Initialize critical adapters in dependency order (20-40ms)
      await this.initializeCriticalAdapters();

      // Step 3: Discover and register routes (10-20ms)
      await this.discoverRoutes();

      // Step 4: Discover and register models (10-20ms)
      await this.discoverModels();

      // Step 5: CRUD generation (deferred to Task 7.3)
      // Will be implemented in a later task

      // Step 6: Lazy adapter loading (deferred to Task 7.2)
      // Auth and email adapters are loaded on first use

      // Step 7: Middleware registration (deferred to Task 7.4)
      // Will be implemented in a later task

      this.state = 'ready';
    } catch (error) {
      this.state = 'uninitialized';
      throw new Error(
        `Runtime initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Start the application
   * 
   * Starts the HTTP server and makes the application ready to handle requests.
   * Must be called after initialize().
   * 
   * @throws {Error} If not in ready state or start fails
   * 
   * @example
   * ```typescript
   * await runtime.start();
   * console.log('Application is running');
   * ```
   */
  async start(): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot start runtime in state: ${this.state}`);
    }

    this.state = 'starting';

    try {
      // Start the API framework adapter (HTTP server)
      const apiAdapter = this.getAdapter<APIFrameworkAdapter>('api');
      
      // Get port from environment or use default
      const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
      
      await apiAdapter.listen(port);

      this.state = 'running';
    } catch (error) {
      this.state = 'ready';
      throw new Error(
        `Runtime start failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gracefully shutdown the application
   * 
   * Stops accepting new requests, waits for existing requests to complete,
   * closes database connections, and cleans up resources.
   * 
   * @param timeout - Maximum time to wait for graceful shutdown (milliseconds)
   * @throws {Error} If shutdown fails or times out
   * 
   * @example
   * ```typescript
   * // Shutdown with 5 second timeout
   * await runtime.shutdown(5000);
   * ```
   */
  async shutdown(timeout: number = 10000): Promise<void> {
    if (this.state === 'stopped' || this.state === 'uninitialized') {
      return; // Already stopped
    }

    if (this.state === 'shutting_down') {
      throw new Error('Shutdown already in progress');
    }

    const previousState = this.state;
    this.state = 'shutting_down';

    // Suppress unused variable warning - we keep this for potential future use
    void previousState;

    try {
      // Create shutdown promise with timeout
      const shutdownPromise = this.performShutdown();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout exceeded')), timeout);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);
    } catch (error) {
      // Always transition to stopped state, even on error
      // This ensures the runtime is in a consistent state
      this.state = 'stopped';
      throw new Error(
        `Runtime shutdown failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.state = 'stopped';
  }

  /**
   * Get the model registry
   * 
   * @returns Model registry instance
   * 
   * @example
   * ```typescript
   * const registry = runtime.getModelRegistry();
   * const user = registry.get('User');
   * ```
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  /**
   * Get the route registry
   * 
   * @returns Route registry instance
   * 
   * @example
   * ```typescript
   * const registry = runtime.getRouteRegistry();
   * const routes = registry.getAll();
   * ```
   */
  getRouteRegistry(): RouteRegistry {
    return this.routeRegistry;
  }

  /**
   * Get an adapter by type
   * 
   * For lazy-loaded adapters (auth, email), this will initialize them on first access.
   * 
   * @param type - Adapter type
   * @returns Adapter instance
   * @throws {Error} If adapter not found or initialization fails
   * 
   * @example
   * ```typescript
   * const dbAdapter = runtime.getAdapter<DatabaseAdapter>('database');
   * await dbAdapter.query('SELECT * FROM users', []);
   * ```
   */
  getAdapter<T>(type: AdapterType): T {
    // Check if adapter is already initialized
    if (this.adapters.has(type)) {
      return this.adapters.get(type) as T;
    }

    // Check if this is a lazy-loaded adapter
    if (this.lazyAdapters.has(type)) {
      // Initialize lazy adapter synchronously (will be async in Task 7.2)
      this.initializeLazyAdapter(type);
      return this.adapters.get(type) as T;
    }

    throw new Error(`Adapter not found: ${type}`);
  }

  /**
   * Get current runtime state
   * 
   * @returns Current state
   * 
   * @example
   * ```typescript
   * if (runtime.getState() === 'running') {
   *   console.log('Application is running');
   * }
   * ```
   */
  getState(): RuntimeState {
    return this.state;
  }

  /**
   * Check if runtime is ready to handle requests
   * 
   * @returns True if running, false otherwise
   * 
   * @example
   * ```typescript
   * if (runtime.isReady()) {
   *   // Handle request
   * }
   * ```
   */
  isReady(): boolean {
    return this.state === 'running';
  }

  /**
   * Initialize critical adapters in dependency order
   * 
   * Critical adapters are initialized during startup:
   * 1. Validation adapter (no dependencies)
   * 2. Database adapter (depends on validation)
   * 3. API framework adapter (depends on validation)
   * 
   * Non-critical adapters (auth, email) are lazy-loaded on first use.
   */
  private async initializeCriticalAdapters(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Initialize validation adapter first (no dependencies)
    await this.initializeAdapter('validation');

    // Initialize database adapter (depends on validation)
    await this.initializeAdapter('database');

    // Initialize API framework adapter (depends on validation)
    await this.initializeAdapter('api');
  }

  /**
   * Initialize a specific adapter
   * 
   * @param type - Adapter type to initialize
   */
  private async initializeAdapter(type: AdapterType): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Get adapter configuration
    const adapterConfig = this.config.adapters[type];
    if (!adapterConfig) {
      // Optional adapters (auth, email) may not be configured
      if (type === 'auth' || type === 'email') {
        return;
      }
      throw new Error(`Adapter configuration not found: ${type}`);
    }

    try {
      // In a real implementation, this would dynamically import the adapter package
      // For now, we'll create a placeholder that throws an error
      // This will be replaced with actual adapter loading in integration
      
      // Example of what this would look like:
      // const AdapterClass = await import(adapterConfig.package);
      // const adapter = new AdapterClass(adapterConfig.options);
      
      // For now, create a mock adapter for testing
      const adapter = this.createMockAdapter(type);
      
      // Initialize the adapter
      if (type === 'database') {
        const dbAdapter = adapter as DatabaseAdapter;
        await dbAdapter.connect(this.config.database);
        
        // Register shutdown handler
        this.shutdownHandlers.push(async () => {
          await dbAdapter.disconnect();
        });
      }

      // Store the adapter
      this.adapters.set(type, adapter);
    } catch (error) {
      throw new Error(
        `Failed to initialize ${type} adapter: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Initialize a lazy-loaded adapter on first use
   * 
   * @param type - Adapter type to initialize
   */
  private initializeLazyAdapter(type: AdapterType): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Check if adapter is configured
    const adapterConfig = this.config.adapters[type];
    if (!adapterConfig) {
      throw new Error(`Adapter not configured: ${type}`);
    }

    // Create mock adapter for now
    const adapter = this.createMockAdapter(type);
    this.adapters.set(type, adapter);
  }

  /**
   * Create a mock adapter for testing
   * 
   * This is a placeholder that will be replaced with actual adapter loading
   * in the integration phase.
   * 
   * @param type - Adapter type
   * @returns Mock adapter
   */
  private createMockAdapter(type: AdapterType): unknown {
    // Create a minimal mock that satisfies the interface
    switch (type) {
      case 'api':
        return {
          registerRoute: () => {},
          registerMiddleware: () => {},
          handleRequest: async () => new Response('OK'),
          listen: async () => {},
          close: async () => {},
        } as APIFrameworkAdapter;

      case 'database':
        return {
          connect: async () => {},
          disconnect: async () => {},
          healthCheck: async () => true,
          query: async () => [],
          execute: async () => {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transaction: async (callback: any) => callback({} as any),
          select: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: () => ({
                    execute: async () => [],
                  }),
                }),
              }),
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          insert: async (_model: any, data: any) => data,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: async (_model: any, _id: any, data: any) => data,
          delete: async () => {},
          createTable: async () => {},
          dropTable: async () => {},
          migrateSchema: async () => {},
        } as unknown as DatabaseAdapter;

      case 'validation':
        return {
          defineSchema: () => ({}),
          validate: () => ({ success: true, data: {} }),
          validateAsync: async () => ({ success: true, data: {} }),
          merge: () => ({}),
          partial: () => ({}),
          pick: () => ({}),
          infer: () => ({}),
        } as ValidationAdapter;

      case 'auth':
        return {
          createSession: async () => ({
            id: 'mock-session',
            userId: 'mock-user',
            expiresAt: new Date(),
            attributes: {},
          }),
          validateSession: async () => ({ valid: false }),
          invalidateSession: async () => {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createUser: async (data: any) => ({ id: 'mock-user', email: 'mock@example.com', ...data }),
          getUser: async () => null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateUser: async (id: any, data: any) => ({ id, email: 'mock@example.com', ...data }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hashPassword: async (password: any) => `hashed:${password}`,
          verifyPassword: async () => false,
          getOAuthAuthorizationUrl: () => '',
          handleOAuthCallback: async () => ({ id: 'mock-user', email: 'mock@example.com' }),
          createApiKey: async () => ({ id: 'mock-key', key: 'mock', scopes: [] }),
          validateApiKey: async () => ({ valid: false }),
          revokeApiKey: async () => {},
        } as unknown as AuthAdapter;

      case 'email':
        return {
          send: async () => ({ id: 'mock-email', success: true }),
          sendBatch: async () => [],
          sendTemplate: async () => ({ id: 'mock-email', success: true }),
          verifyDomain: async () => ({ domain: 'example.com', verified: false }),
        } as unknown as EmailAdapter;

      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }
  }

  /**
   * Discover and register routes from the routes directory
   */
  private async discoverRoutes(): Promise<void> {
    // Default routes directory
    const routesDir = './src/routes';

    try {
      await this.routeDiscovery.discover(routesDir);
    } catch (error) {
      // If routes directory doesn't exist, that's okay (no custom routes)
      if (error instanceof Error && error.message.includes('not found')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Discover and register models from the models directory
   */
  private async discoverModels(): Promise<void> {
    // Model discovery will be implemented in a similar way to route discovery
    // For now, this is a placeholder that does nothing
    // Models are typically registered programmatically by importing model files
    
    // In a real implementation, this would:
    // 1. Scan the models directory
    // 2. Import each model file
    // 3. Register models with the model registry
    
    // For now, we'll leave this as a no-op since models are registered
    // programmatically in the application code
  }

  /**
   * Perform the actual shutdown sequence
   */
  private async performShutdown(): Promise<void> {
    const errors: Error[] = [];

    // Step 1: Stop accepting new requests
    try {
      const apiAdapter = this.adapters.get('api') as APIFrameworkAdapter | undefined;
      if (apiAdapter) {
        await apiAdapter.close();
      }
    } catch (error) {
      errors.push(
        new Error(`Failed to close API adapter: ${error instanceof Error ? error.message : String(error)}`)
      );
    }

    // Step 2: Execute shutdown handlers (database disconnect, etc.)
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        errors.push(
          new Error(`Shutdown handler failed: ${error instanceof Error ? error.message : String(error)}`)
        );
      }
    }

    // Step 3: Clear registries
    this.routeRegistry.clear();
    this.modelRegistry.clear();

    // Step 4: Clear adapters
    this.adapters.clear();

    // If there were errors, throw them
    if (errors.length > 0) {
      throw new Error(
        `Shutdown completed with errors:\n${errors.map((e) => `  - ${e.message}`).join('\n')}`
      );
    }
  }
}
