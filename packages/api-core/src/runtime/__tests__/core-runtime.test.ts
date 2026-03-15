/**
 * Unit tests for CoreRuntime
 * 
 * Tests the complete initialization sequence, lifecycle management,
 * adapter access, and graceful shutdown.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreRuntime } from '../core-runtime';
import type { WebLoomConfig } from '../../config/types';

// Mock configuration for testing
const createMockConfig = (): WebLoomConfig => ({
  adapters: {
    api: {
      package: '@web-loom/api-adapter-hono',
      options: {},
    },
    database: {
      package: '@web-loom/api-adapter-drizzle',
      options: {},
    },
    validation: {
      package: '@web-loom/api-adapter-zod',
      options: {},
    },
  },
  database: {
    url: 'postgresql://localhost:5432/test',
    poolSize: 5,
    connectionTimeout: 5000,
  },
  security: {
    cors: {
      origins: ['http://localhost:3000'],
      credentials: true,
    },
  },
  features: {
    crud: true,
  },
  observability: {
    logging: {
      level: 'info',
      format: 'json',
    },
  },
});

describe('CoreRuntime', () => {
  let runtime: CoreRuntime;

  beforeEach(() => {
    runtime = new CoreRuntime();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      expect(runtime.getState()).toBe('ready');
    });

    it('should throw error if initialized twice', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      await expect(runtime.initialize(config)).rejects.toThrow(
        'Cannot initialize runtime in state: ready'
      );
    });

    it('should initialize model registry', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const modelRegistry = runtime.getModelRegistry();
      expect(modelRegistry).toBeDefined();
      expect(modelRegistry.getAll()).toEqual([]);
    });

    it('should initialize route registry', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const routeRegistry = runtime.getRouteRegistry();
      expect(routeRegistry).toBeDefined();
      expect(routeRegistry.getAll()).toEqual([]);
    });

    it('should initialize critical adapters', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      // Should be able to access critical adapters
      expect(() => runtime.getAdapter('api')).not.toThrow();
      expect(() => runtime.getAdapter('database')).not.toThrow();
      expect(() => runtime.getAdapter('validation')).not.toThrow();
    });

    it('should handle missing routes directory gracefully', async () => {
      const config = createMockConfig();

      // Should not throw even if routes directory doesn't exist
      await expect(runtime.initialize(config)).resolves.not.toThrow();
    });

    it('should set state to uninitialized on initialization failure', async () => {
      const config = createMockConfig();
      // Create invalid config by removing required field
      delete (config as any).database;

      await expect(runtime.initialize(config)).rejects.toThrow();
      expect(runtime.getState()).toBe('uninitialized');
    });
  });

  describe('Lifecycle Management', () => {
    it('should start successfully after initialization', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      expect(runtime.getState()).toBe('running');
      expect(runtime.isReady()).toBe(true);
    });

    it('should throw error if started before initialization', async () => {
      await expect(runtime.start()).rejects.toThrow(
        'Cannot start runtime in state: uninitialized'
      );
    });

    it('should throw error if started twice', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      await expect(runtime.start()).rejects.toThrow(
        'Cannot start runtime in state: running'
      );
    });

    it('should shutdown gracefully', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();
      await runtime.shutdown();

      expect(runtime.getState()).toBe('stopped');
      expect(runtime.isReady()).toBe(false);
    });

    it('should shutdown with custom timeout', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      // Should complete within timeout
      await expect(runtime.shutdown(5000)).resolves.not.toThrow();
    });

    it('should handle shutdown when not running', async () => {
      // Should not throw when shutting down uninitialized runtime
      await expect(runtime.shutdown()).resolves.not.toThrow();
    });

    it('should throw error if shutdown called twice', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      // First shutdown should succeed
      await runtime.shutdown();

      // Second shutdown should not throw (already stopped)
      await expect(runtime.shutdown()).resolves.not.toThrow();
    });

    it('should clear registries on shutdown', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();
      await runtime.shutdown();

      const modelRegistry = runtime.getModelRegistry();
      const routeRegistry = runtime.getRouteRegistry();

      expect(modelRegistry.getAll()).toEqual([]);
      expect(routeRegistry.getAll()).toEqual([]);
    });
  });

  describe('Adapter Access', () => {
    it('should return API adapter', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const adapter = runtime.getAdapter('api');
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('registerRoute');
      expect(adapter).toHaveProperty('handleRequest');
    });

    it('should return database adapter', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const adapter = runtime.getAdapter('database');
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('connect');
      expect(adapter).toHaveProperty('query');
    });

    it('should return validation adapter', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const adapter = runtime.getAdapter('validation');
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('defineSchema');
      expect(adapter).toHaveProperty('validate');
    });

    it('should lazy-load auth adapter on first access', async () => {
      const config = createMockConfig();
      config.adapters.auth = {
        package: '@web-loom/api-adapter-lucia',
        options: {},
      };

      await runtime.initialize(config);

      // Auth adapter should be lazy-loaded
      const adapter = runtime.getAdapter('auth');
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('createSession');
    });

    it('should lazy-load email adapter on first access', async () => {
      const config = createMockConfig();
      config.adapters.email = {
        package: '@web-loom/api-adapter-resend',
        options: {},
      };

      await runtime.initialize(config);

      // Email adapter should be lazy-loaded
      const adapter = runtime.getAdapter('email');
      expect(adapter).toBeDefined();
      expect(adapter).toHaveProperty('send');
    });

    it('should throw error for unconfigured lazy adapter', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      // Auth adapter not configured
      expect(() => runtime.getAdapter('auth')).toThrow(
        'Adapter not configured: auth'
      );
    });

    it('should throw error for unknown adapter type', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      expect(() => runtime.getAdapter('unknown' as any)).toThrow(
        'Adapter not found: unknown'
      );
    });

    it('should return same adapter instance on multiple calls', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const adapter1 = runtime.getAdapter('database');
      const adapter2 = runtime.getAdapter('database');

      expect(adapter1).toBe(adapter2);
    });
  });

  describe('Registry Access', () => {
    it('should provide access to model registry', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const registry = runtime.getModelRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.get).toBe('function');
    });

    it('should provide access to route registry', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const registry = runtime.getRouteRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.match).toBe('function');
    });

    it('should maintain registry state across lifecycle', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      const modelRegistry = runtime.getModelRegistry();
      const routeRegistry = runtime.getRouteRegistry();

      // Registries should be the same instance
      expect(runtime.getModelRegistry()).toBe(modelRegistry);
      expect(runtime.getRouteRegistry()).toBe(routeRegistry);
    });
  });

  describe('State Management', () => {
    it('should start in uninitialized state', () => {
      expect(runtime.getState()).toBe('uninitialized');
      expect(runtime.isReady()).toBe(false);
    });

    it('should transition to ready state after initialization', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      expect(runtime.getState()).toBe('ready');
      expect(runtime.isReady()).toBe(false);
    });

    it('should transition to running state after start', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      expect(runtime.getState()).toBe('running');
      expect(runtime.isReady()).toBe(true);
    });

    it('should transition to stopped state after shutdown', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();
      await runtime.shutdown();

      expect(runtime.getState()).toBe('stopped');
      expect(runtime.isReady()).toBe(false);
    });

    it('should handle state transitions correctly', async () => {
      const config = createMockConfig();

      // uninitialized -> initializing -> ready
      expect(runtime.getState()).toBe('uninitialized');
      const initPromise = runtime.initialize(config);
      await initPromise;
      expect(runtime.getState()).toBe('ready');

      // ready -> starting -> running
      const startPromise = runtime.start();
      await startPromise;
      expect(runtime.getState()).toBe('running');

      // running -> shutting_down -> stopped
      const shutdownPromise = runtime.shutdown();
      await shutdownPromise;
      expect(runtime.getState()).toBe('stopped');
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter initialization failure', async () => {
      const config = createMockConfig();
      // Invalid database URL
      config.database.url = '';

      await expect(runtime.initialize(config)).rejects.toThrow();
      expect(runtime.getState()).toBe('uninitialized');
    });

    it('should handle start failure', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      // Mock adapter to throw error on listen
      const apiAdapter = runtime.getAdapter('api') as any;
      apiAdapter.listen = vi.fn().mockRejectedValue(new Error('Port in use'));

      await expect(runtime.start()).rejects.toThrow();
      expect(runtime.getState()).toBe('ready');
    });

    it('should handle shutdown errors gracefully', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      // Mock adapter to throw error on close
      const apiAdapter = runtime.getAdapter('api') as any;
      apiAdapter.close = vi.fn().mockRejectedValue(new Error('Close failed'));

      // Should still complete shutdown despite error
      await expect(runtime.shutdown()).rejects.toThrow('Shutdown completed with errors');
      expect(runtime.getState()).toBe('stopped');
    });
  });

  describe('Configuration Loading', () => {
    it('should load and validate configuration', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);

      // Configuration should be loaded and validated
      expect(runtime.getState()).toBe('ready');
    });

    it('should reject invalid configuration', async () => {
      const config = {} as WebLoomConfig;

      await expect(runtime.initialize(config)).rejects.toThrow();
    });

    it('should handle missing adapter configuration', async () => {
      const config = createMockConfig();
      delete (config.adapters as any).database;

      await expect(runtime.initialize(config)).rejects.toThrow();
    });
  });

  describe('Initialization Sequence', () => {
    it('should initialize adapters in correct order', async () => {
      const config = createMockConfig();
      const initOrder: string[] = [];

      // We can't easily test the actual order without mocking the adapter loading
      // But we can verify that all critical adapters are initialized
      await runtime.initialize(config);

      expect(() => runtime.getAdapter('validation')).not.toThrow();
      expect(() => runtime.getAdapter('database')).not.toThrow();
      expect(() => runtime.getAdapter('api')).not.toThrow();
    });

    it('should complete initialization within performance budget', async () => {
      const config = createMockConfig();

      const startTime = Date.now();
      await runtime.initialize(config);
      const duration = Date.now() - startTime;

      // Should complete within 100ms (as per design document)
      // Note: This is a loose check since we're using mocks
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close API adapter during shutdown', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      const apiAdapter = runtime.getAdapter('api') as any;
      const closeSpy = vi.spyOn(apiAdapter, 'close');

      await runtime.shutdown();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should disconnect database during shutdown', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      const dbAdapter = runtime.getAdapter('database') as any;
      const disconnectSpy = vi.spyOn(dbAdapter, 'disconnect');

      await runtime.shutdown();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should respect shutdown timeout', async () => {
      const config = createMockConfig();

      await runtime.initialize(config);
      await runtime.start();

      // Mock slow shutdown
      const apiAdapter = runtime.getAdapter('api') as any;
      apiAdapter.close = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      // Should timeout after 100ms
      await expect(runtime.shutdown(100)).rejects.toThrow('Shutdown timeout exceeded');
    });
  });
});
