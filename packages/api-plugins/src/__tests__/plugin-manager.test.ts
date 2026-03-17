import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from '../plugin-manager';
import type { Plugin, PluginContext } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlugin(overrides: Partial<Plugin> & { name: string }): Plugin {
  return {
    version: '1.0.0',
    register: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Plugin loading & validation
// ---------------------------------------------------------------------------

describe('PluginManager – loadPlugin', () => {
  it('loads a valid plugin', () => {
    const mgr = new PluginManager();
    const p = makePlugin({ name: 'test-plugin' });
    mgr.loadPlugin(p);
    expect(mgr.getPluginNames()).toEqual(['test-plugin']);
    expect(mgr.getPluginState('test-plugin')).toBe('loaded');
  });

  it('rejects duplicate plugin names', () => {
    const mgr = new PluginManager();
    mgr.loadPlugin(makePlugin({ name: 'dup' }));
    expect(() => mgr.loadPlugin(makePlugin({ name: 'dup' }))).toThrow(
      'already loaded',
    );
  });

  it('rejects plugin without name', () => {
    const mgr = new PluginManager();
    expect(() => mgr.loadPlugin({ name: '', version: '1', register: vi.fn() })).toThrow(
      'non-empty "name"',
    );
  });

  it('rejects plugin without version', () => {
    const mgr = new PluginManager();
    expect(() =>
      mgr.loadPlugin({ name: 'x', version: '', register: vi.fn() }),
    ).toThrow('non-empty "version"');
  });

  it('rejects plugin without register function', () => {
    const mgr = new PluginManager();
    expect(() =>
      mgr.loadPlugin({ name: 'x', version: '1' } as unknown as Plugin),
    ).toThrow('"register" function');
  });
});


// ---------------------------------------------------------------------------
// Lifecycle: initializeAll
// ---------------------------------------------------------------------------

describe('PluginManager – initializeAll', () => {
  it('runs register → onInit → onReady in order', async () => {
    const order: string[] = [];
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'a',
      version: '1.0.0',
      register: () => { order.push('a:register'); },
      onInit: () => { order.push('a:init'); },
      onReady: () => { order.push('a:ready'); },
    });

    await mgr.initializeAll();

    expect(order).toEqual(['a:register', 'a:init', 'a:ready']);
    expect(mgr.getPluginState('a')).toBe('ready');
  });

  it('respects dependency order', async () => {
    const order: string[] = [];
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'base',
      version: '1.0.0',
      register: () => { order.push('base:register'); },
    });

    mgr.loadPlugin({
      name: 'dependent',
      version: '1.0.0',
      dependencies: ['base'],
      register: () => { order.push('dependent:register'); },
    });

    await mgr.initializeAll();

    expect(order).toEqual(['base:register', 'dependent:register']);
  });

  it('detects circular dependencies', async () => {
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'a',
      version: '1.0.0',
      dependencies: ['b'],
      register: vi.fn(),
    });

    mgr.loadPlugin({
      name: 'b',
      version: '1.0.0',
      dependencies: ['a'],
      register: vi.fn(),
    });

    await expect(mgr.initializeAll()).rejects.toThrow('Circular plugin dependency');
  });

  it('detects missing dependencies', async () => {
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'orphan',
      version: '1.0.0',
      dependencies: ['missing'],
      register: vi.fn(),
    });

    await expect(mgr.initializeAll()).rejects.toThrow('which is not loaded');
  });

  it('sets error state when register throws', async () => {
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'bad',
      version: '1.0.0',
      register: () => { throw new Error('boom'); },
    });

    await expect(mgr.initializeAll()).rejects.toThrow('failed during register');
    expect(mgr.getPluginState('bad')).toBe('error');
  });

  it('sets error state when onInit throws', async () => {
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'bad-init',
      version: '1.0.0',
      register: vi.fn(),
      onInit: () => { throw new Error('init-boom'); },
    });

    await expect(mgr.initializeAll()).rejects.toThrow('failed during onInit');
    expect(mgr.getPluginState('bad-init')).toBe('error');
  });
});


// ---------------------------------------------------------------------------
// Lifecycle: shutdownAll
// ---------------------------------------------------------------------------

describe('PluginManager – shutdownAll', () => {
  it('calls onShutdown in reverse dependency order', async () => {
    const order: string[] = [];
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'base',
      version: '1.0.0',
      register: vi.fn(),
      onShutdown: () => { order.push('base:shutdown'); },
    });

    mgr.loadPlugin({
      name: 'child',
      version: '1.0.0',
      dependencies: ['base'],
      register: vi.fn(),
      onShutdown: () => { order.push('child:shutdown'); },
    });

    await mgr.initializeAll();
    await mgr.shutdownAll();

    // child shuts down before base (reverse order)
    expect(order).toEqual(['child:shutdown', 'base:shutdown']);
    expect(mgr.getPluginState('base')).toBe('shutdown');
    expect(mgr.getPluginState('child')).toBe('shutdown');
  });

  it('continues shutdown even if one plugin throws', async () => {
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'ok',
      version: '1.0.0',
      register: vi.fn(),
      onShutdown: vi.fn(),
    });

    mgr.loadPlugin({
      name: 'bad',
      version: '1.0.0',
      register: vi.fn(),
      onShutdown: () => { throw new Error('shutdown-fail'); },
    });

    await mgr.initializeAll();
    // Should not throw — errors are swallowed during shutdown
    await mgr.shutdownAll();

    expect(mgr.getPluginState('bad')).toBe('error');
    expect(mgr.getPluginState('ok')).toBe('shutdown');
  });
});

// ---------------------------------------------------------------------------
// Extension points (PluginContext integration)
// ---------------------------------------------------------------------------

describe('PluginManager – extension points', () => {
  it('plugin can register middleware via context', async () => {
    const mgr = new PluginManager();
    const handler = vi.fn();

    mgr.loadPlugin({
      name: 'mw-plugin',
      version: '1.0.0',
      register: (ctx: PluginContext) => {
        ctx.addMiddleware(handler);
      },
    });

    await mgr.initializeAll();
    expect(mgr.context.middleware).toEqual([handler]);
  });

  it('plugin can register routes via context', async () => {
    const mgr = new PluginManager();
    const routeHandler = vi.fn();

    mgr.loadPlugin({
      name: 'route-plugin',
      version: '1.0.0',
      register: (ctx: PluginContext) => {
        ctx.addRoute({ method: 'GET', path: '/health', handler: routeHandler });
      },
    });

    await mgr.initializeAll();
    expect(mgr.context.routes).toHaveLength(1);
    expect(mgr.context.routes[0]!.path).toBe('/health');
  });

  it('plugin can register models via context', async () => {
    const mgr = new PluginManager();

    mgr.loadPlugin({
      name: 'model-plugin',
      version: '1.0.0',
      register: (ctx: PluginContext) => {
        ctx.addModel({ name: 'AuditLog', fields: { action: 'string' } });
      },
    });

    await mgr.initializeAll();
    expect(mgr.context.models).toHaveLength(1);
    expect(mgr.context.models[0]!.name).toBe('AuditLog');
  });

  it('plugin can extend config via context', async () => {
    const mgr = new PluginManager({}, { existing: true });

    mgr.loadPlugin({
      name: 'config-plugin',
      version: '1.0.0',
      register: (ctx: PluginContext) => {
        ctx.extendConfig({ myPluginOption: 42 });
      },
    });

    await mgr.initializeAll();
    const cfg = mgr.context.getConfig();
    expect(cfg['existing']).toBe(true);
    expect(cfg['myPluginOption']).toBe(42);
  });
});
