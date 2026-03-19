/**
 * CRUD Generator — DEPRECATED
 *
 * This module is a stub. The original adapter-based CRUD generator has been
 * removed as part of the stack-foundation refactor.
 *
 * The replacement implementation lives in the `crud-generator` spec
 * (Phase 3) and will use Drizzle ORM query builders directly via
 * `generateCrudRouter(model)`.
 *
 * @see .kiro/specs/crud-generator/
 */

export interface CRUDOptions {
  basePath: string;
  enableSoftDelete?: boolean;
  enableOptimisticLocking?: boolean;
  excludeFields?: string[];
  enablePagination?: boolean;
  defaultPageSize?: number;
  maxPageSize?: number;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableFieldSelection?: boolean;
  enableSearch?: boolean;
  searchFields?: string[];
  enableCursorPagination?: boolean;
  enableRelationships?: boolean;
}

export interface RouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (ctx: any) => Promise<Response>;
}

/**
 * @deprecated Will be replaced by `generateCrudRouter()` in Phase 3.
 */
export class CRUDGenerator {
  generate(_model: unknown, _options: CRUDOptions): RouteHandler[] {
    throw new Error(
      'CRUDGenerator is deprecated. Use generateCrudRouter() from @web-loom/api-generator-crud once Phase 3 is implemented.'
    );
  }
}
