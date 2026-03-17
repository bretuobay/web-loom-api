/**
 * Factory and seeding utilities for test data generation
 */

// ---- Built-in generators ----

let _sequenceCounter = 0;

export function randomString(len = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomEmail(): string {
  return `${randomString(8)}@${randomString(5)}.test`;
}

export function randomDate(start?: Date, end?: Date): Date {
  const s = start?.getTime() ?? new Date('2020-01-01').getTime();
  const e = end?.getTime() ?? Date.now();
  return new Date(s + Math.random() * (e - s));
}

export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sequence(prefix = 'item'): string {
  return `${prefix}-${++_sequenceCounter}`;
}

/** Reset the sequence counter (useful between tests) */
export function resetSequence(): void {
  _sequenceCounter = 0;
}


// ---- Factory types ----

export type FactoryAttrs<T> = Partial<T> | (() => Partial<T>);

export interface RelationConfig<T> {
  factory: Factory<T>;
  foreignKey?: string;
  count?: number;
}

export interface Factory<T extends Record<string, unknown>> {
  /** Build a single instance (in-memory only) */
  build(overrides?: Partial<T>): T;
  /** Build multiple instances (in-memory only) */
  buildMany(count: number, overrides?: Partial<T>): T[];
  /** Create a persisted instance via the persist callback */
  create(overrides?: Partial<T>): Promise<T>;
  /** Create multiple persisted instances */
  createMany(count: number, overrides?: Partial<T>): Promise<T[]>;
  /** Register a relationship with another factory */
  withRelation<R extends Record<string, unknown>>(
    name: string,
    factory: Factory<R>,
    options?: { foreignKey?: string; count?: number }
  ): Factory<T>;
}

type PersistFn<T> = (data: T) => Promise<T>;

interface FactoryOptions<T extends Record<string, unknown>> {
  defaultAttrs: FactoryAttrs<T>;
  persistFn?: PersistFn<T>;
  relations: Map<string, RelationConfig<unknown>>;
}

/**
 * Define a factory for generating test data.
 *
 * @param name - Factory name (for debugging)
 * @param defaultAttrs - Default attributes or generator function
 * @param persistFn - Optional async function to persist created instances
 */
export function defineFactory<T extends Record<string, unknown>>(
  name: string,
  defaultAttrs: FactoryAttrs<T>,
  persistFn?: PersistFn<T>
): Factory<T> {
  const options: FactoryOptions<T> = {
    defaultAttrs,
    persistFn,
    relations: new Map(),
  };

  return createFactory<T>(name, options);
}

function resolveAttrs<T>(attrs: FactoryAttrs<T>): Partial<T> {
  return typeof attrs === 'function' ? attrs() : { ...attrs };
}

function createFactory<T extends Record<string, unknown>>(
  _name: string,
  options: FactoryOptions<T>
): Factory<T> {
  const factory: Factory<T> = {
    build(overrides?: Partial<T>): T {
      const base = resolveAttrs(options.defaultAttrs);
      const merged = { ...base, ...overrides } as T;

      // Resolve relations
      for (const [relName, relConfig] of options.relations) {
        if (!(relName in merged)) {
          const relFactory = relConfig.factory as Factory<Record<string, unknown>>;
          const count = relConfig.count ?? 1;
          if (count === 1) {
            (merged as Record<string, unknown>)[relName] = relFactory.build();
          } else {
            (merged as Record<string, unknown>)[relName] = relFactory.buildMany(count);
          }
        }
      }

      return merged;
    },

    buildMany(count: number, overrides?: Partial<T>): T[] {
      return Array.from({ length: count }, () => factory.build(overrides));
    },

    async create(overrides?: Partial<T>): Promise<T> {
      const instance = factory.build(overrides);
      if (options.persistFn) {
        return options.persistFn(instance);
      }
      return instance;
    },

    async createMany(count: number, overrides?: Partial<T>): Promise<T[]> {
      const results: T[] = [];
      for (let i = 0; i < count; i++) {
        results.push(await factory.create(overrides));
      }
      return results;
    },

    withRelation<R extends Record<string, unknown>>(
      name: string,
      relFactory: Factory<R>,
      relOptions?: { foreignKey?: string; count?: number }
    ): Factory<T> {
      const newRelations = new Map(options.relations);
      newRelations.set(name, {
        factory: relFactory as Factory<unknown>,
        foreignKey: relOptions?.foreignKey,
        count: relOptions?.count,
      });
      return createFactory<T>(_name, {
        ...options,
        relations: newRelations,
      });
    },
  };

  return factory;
}

/**
 * Bulk seed data using multiple factories.
 */
export async function seed<T extends Record<string, Record<string, unknown>>>(
  factories: {
    [K in keyof T]: {
      factory: Factory<T[K]>;
      count: number;
      overrides?: Partial<T[K]>;
    };
  }
): Promise<{ [K in keyof T]: T[K][] }> {
  const result = {} as { [K in keyof T]: T[K][] };

  for (const key of Object.keys(factories) as (keyof T)[]) {
    const { factory, count, overrides } = factories[key];
    result[key] = await factory.createMany(count, overrides);
  }

  return result;
}
