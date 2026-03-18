import type { Table } from 'drizzle-orm';
import { DuplicateModelError } from '../errors/duplicate-model-error';
import type { AnyModel } from './types';

/**
 * Registry for all models registered via `defineModel()`.
 *
 * Keyed by `meta.name` (PascalCase). Consumed by the CRUD generator and the
 * OpenAPI generator to produce routes and documentation automatically.
 */
export class ModelRegistry {
  private readonly models = new Map<string, AnyModel>();

  register(model: AnyModel): void {
    if (this.models.has(model.meta.name)) {
      throw new DuplicateModelError(model.meta.name);
    }
    this.models.set(model.meta.name, model);
  }

  get(name: string): AnyModel | undefined {
    return this.models.get(name);
  }

  getAll(): AnyModel[] {
    return [...this.models.values()];
  }

  has(name: string): boolean {
    return this.models.has(name);
  }

  /** Clear all registrations. Primarily for test teardown. */
  clear(): void {
    this.models.clear();
  }
}

/**
 * Global singleton used by `defineModel()` and the generators.
 *
 * Access from an Application instance via `app.getModelRegistry()`.
 */
export const modelRegistry = new ModelRegistry();
