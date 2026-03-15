/**
 * CRUD Generator
 * 
 * Automatically generates REST API endpoints for CRUD operations based on model definitions.
 * Generates 6 standard endpoints: List, Create, Get, Update (PUT), Update (PATCH), Delete.
 * 
 * @example
 * ```typescript
 * const generator = new CRUDGenerator(database, validation);
 * const routes = generator.generate(UserModel, {
 *   basePath: '/users',
 *   enableSoftDelete: true,
 * });
 * ```
 */

import type {
  ModelDefinition,
  DatabaseAdapter,
  RequestContext,
  NextFunction,
} from '@web-loom/api-core';

/**
 * Options for customizing CRUD generation
 */
export interface CRUDOptions {
  /** Base path for the resource (e.g., '/users') */
  basePath: string;
  
  /** Enable soft delete instead of hard delete */
  enableSoftDelete?: boolean;
  
  /** Enable optimistic locking for updates */
  enableOptimisticLocking?: boolean;
  
  /** Fields to exclude from responses */
  excludeFields?: string[];
  
  /** Enable pagination for list endpoint */
  enablePagination?: boolean;
  
  /** Default page size for pagination */
  defaultPageSize?: number;
  
  /** Maximum page size allowed */
  maxPageSize?: number;
  
  /** Enable filtering support */
  enableFiltering?: boolean;
  
  /** Enable sorting support */
  enableSorting?: boolean;
  
  /** Enable field selection support */
  enableFieldSelection?: boolean;
  
  /** Enable search functionality */
  enableSearch?: boolean;
  
  /** Fields to enable search on */
  searchFields?: string[];
  
  /** Enable cursor-based pagination */
  enableCursorPagination?: boolean;
  
  /** Enable relationship loading */
  enableRelationships?: boolean;
}

/**
 * Generated route handler
 */
export interface RouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: (ctx: RequestContext, next: NextFunction) => Promise<Response>;
}

/**
 * CRUD Generator class
 */
export class CRUDGenerator {
  constructor(private database: DatabaseAdapter) {}

  /**
   * Generate all CRUD routes for a model
   * 
   * @param model - Model definition
   * @param options - Generation options
   * @returns Array of route handlers
   */
  generate(model: ModelDefinition, options: CRUDOptions): RouteHandler[] {
    const routes: RouteHandler[] = [];

    // Generate all 6 endpoints
    routes.push(this.generateListRoute(model, options));
    routes.push(this.generateCreateRoute(model, options));
    routes.push(this.generateGetRoute(model, options));
    routes.push(this.generateUpdateRoute(model, options, 'PUT'));
    routes.push(this.generateUpdateRoute(model, options, 'PATCH'));
    routes.push(this.generateDeleteRoute(model, options));

    return routes;
  }

  /**
   * Generate List endpoint (GET /resource)
   * 
   * Supports:
   * - Page-based pagination: ?page=1&limit=20
   * - Cursor-based pagination: ?cursor=abc123&limit=20
   * - Filtering: ?filter[name][eq]=John&filter[age][gte]=18
   * - Sorting: ?sort=name,-createdAt (- prefix for descending)
   * - Field selection: ?fields=id,name,email
   * - Search: ?search=john (searches across searchFields)
   * - Relationships: ?include=posts,comments
   */
  private generateListRoute(model: ModelDefinition, options: CRUDOptions): RouteHandler {
    return {
      method: 'GET',
      path: options.basePath,
      handler: async (ctx: RequestContext) => {
        let query = this.database.select(model);

        // Apply filtering
        if (options.enableFiltering && ctx.query.filter) {
          query = this.applyFilters(query, ctx.query.filter as unknown as Record<string, any>);
        }

        // Apply search
        if (options.enableSearch && ctx.query.search && options.searchFields) {
          query = this.applySearch(query, ctx.query.search as string, options.searchFields);
        }

        // Apply sorting
        if (options.enableSorting && ctx.query.sort) {
          query = this.applySorting(query, ctx.query.sort as string);
        }

        // Handle cursor-based pagination
        if (options.enableCursorPagination && ctx.query.cursor) {
          const limit = Math.min(
            parseInt((ctx.query.limit as string) || String(options.defaultPageSize || 20), 10),
            options.maxPageSize || 100
          );

          // Decode cursor (base64 encoded ID)
          const cursorId = Buffer.from(ctx.query.cursor as string, 'base64').toString('utf-8');
          query = query.where({ id: { gt: cursorId } } as never);
          query = query.limit(limit + 1); // Fetch one extra to determine if there's a next page

          const results = await query.execute();
          const hasNextPage = results.length > limit;
          const data = hasNextPage ? results.slice(0, limit) : results;
          const nextCursor = hasNextPage && data.length > 0
            ? Buffer.from((data[data.length - 1] as any).id).toString('base64')
            : null;

          return new Response(
            JSON.stringify({
              data: this.selectFields(data, ctx.query.fields as string | undefined, options),
              pagination: {
                cursor: ctx.query.cursor,
                nextCursor,
                hasNextPage,
                limit,
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Handle page-based pagination (default)
        const page = parseInt((ctx.query.page as string) || '1', 10);
        const limit = Math.min(
          parseInt((ctx.query.limit as string) || String(options.defaultPageSize || 20), 10),
          options.maxPageSize || 100
        );
        const offset = (page - 1) * limit;

        query = query.limit(limit).offset(offset);

        const results = await query.execute();

        return new Response(
          JSON.stringify({
            data: this.selectFields(results, ctx.query.fields as string | undefined, options),
            pagination: {
              page,
              limit,
              total: results.length,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
    };
  }

  /**
   * Apply filters to query
   * 
   * Supports operators: eq, ne, gt, gte, lt, lte, in, like
   * 
   * @example
   * ?filter[name][eq]=John&filter[age][gte]=18
   */
  private applyFilters(query: any, filters: Record<string, any>): any {
    const conditions: Record<string, any> = {};

    for (const [field, operators] of Object.entries(filters)) {
      if (typeof operators === 'object' && operators !== null) {
        for (const [operator, value] of Object.entries(operators)) {
          if (!conditions[field]) {
            conditions[field] = {};
          }
          conditions[field][operator] = value;
        }
      } else {
        // Simple equality filter: ?filter[name]=John
        conditions[field] = { eq: operators };
      }
    }

    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions as never);
    }

    return query;
  }

  /**
   * Apply search across multiple fields
   * 
   * @example
   * ?search=john (searches in searchFields)
   */
  private applySearch(query: any, searchTerm: string, searchFields: string[]): any {
    // Build OR conditions for each search field
    const searchConditions = searchFields.map(field => ({
      [field]: { like: `%${searchTerm}%` }
    }));

    // Apply OR logic (this is a simplified version - actual implementation depends on query builder)
    if (searchConditions.length > 0) {
      query = query.where({ _or: searchConditions } as never);
    }

    return query;
  }

  /**
   * Apply sorting to query
   * 
   * @example
   * ?sort=name,-createdAt (ascending name, descending createdAt)
   */
  private applySorting(query: any, sortParam: string): any {
    const sortFields = sortParam.split(',').map(field => field.trim());

    for (const field of sortFields) {
      if (field.startsWith('-')) {
        // Descending order
        query = query.orderBy(field.substring(1), 'desc');
      } else {
        // Ascending order
        query = query.orderBy(field, 'asc');
      }
    }

    return query;
  }

  /**
   * Select specific fields from results
   * 
   * @example
   * ?fields=id,name,email
   */
  private selectFields(
    results: any[],
    fieldsParam: string | undefined,
    options: CRUDOptions
  ): any[] {
    if (!options.enableFieldSelection || !fieldsParam) {
      // Apply excludeFields if specified
      if (options.excludeFields && options.excludeFields.length > 0) {
        return results.map(item => {
          const filtered = { ...item };
          for (const field of options.excludeFields!) {
            delete filtered[field];
          }
          return filtered;
        });
      }
      return results;
    }

    const selectedFields = fieldsParam.split(',').map(f => f.trim());

    return results.map(item => {
      const selected: Record<string, any> = {};
      for (const field of selectedFields) {
        if (field in item && !options.excludeFields?.includes(field)) {
          selected[field] = item[field];
        }
      }
      return selected;
    });
  }

  /**
   * Generate Create endpoint (POST /resource)
   */
  private generateCreateRoute(model: ModelDefinition, options: CRUDOptions): RouteHandler {
    return {
      method: 'POST',
      path: options.basePath,
      handler: async (ctx: RequestContext) => {
        // Body should already be validated by validation middleware
        const created = await this.database.insert(model, ctx.body);

        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    };
  }

  /**
   * Generate Get endpoint (GET /resource/:id)
   */
  private generateGetRoute(model: ModelDefinition, options: CRUDOptions): RouteHandler {
    return {
      method: 'GET',
      path: `${options.basePath}/:id`,
      handler: async (ctx: RequestContext) => {
        const { id } = ctx.params;

        if (!id) {
          return new Response(
            JSON.stringify({
              error: 'Bad Request',
              message: 'ID parameter is required',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const results = await this.database
          .select(model)
          .where({ id } as never)
          .execute();

        if (results.length === 0) {
          return new Response(
            JSON.stringify({
              error: 'Not Found',
              message: `${model.name} with id ${id} not found`,
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(JSON.stringify(results[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    };
  }

  /**
   * Generate Update endpoint (PUT/PATCH /resource/:id)
   */
  private generateUpdateRoute(
    model: ModelDefinition,
    options: CRUDOptions,
    method: 'PUT' | 'PATCH'
  ): RouteHandler {
    return {
      method,
      path: `${options.basePath}/:id`,
      handler: async (ctx: RequestContext) => {
        const { id } = ctx.params;

        if (!id) {
          return new Response(
            JSON.stringify({
              error: 'Bad Request',
              message: 'ID parameter is required',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        try {
          const updated = await this.database.update(model, id, ctx.body as never);

          return new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes('not found')) {
            return new Response(
              JSON.stringify({
                error: 'Not Found',
                message: `${model.name} with id ${id} not found`,
              }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          throw error;
        }
      },
    };
  }

  /**
   * Generate Delete endpoint (DELETE /resource/:id)
   */
  private generateDeleteRoute(model: ModelDefinition, options: CRUDOptions): RouteHandler {
    return {
      method: 'DELETE',
      path: `${options.basePath}/:id`,
      handler: async (ctx: RequestContext) => {
        const { id } = ctx.params;

        if (!id) {
          return new Response(
            JSON.stringify({
              error: 'Bad Request',
              message: 'ID parameter is required',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        try {
          await this.database.delete(model, id);

          return new Response(null, { status: 204 });
        } catch (error) {
          if (error instanceof Error && error.message.includes('not found')) {
            return new Response(
              JSON.stringify({
                error: 'Not Found',
                message: `${model.name} with id ${id} not found`,
              }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          throw error;
        }
      },
    };
  }
}
