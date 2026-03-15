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
   */
  private generateListRoute(model: ModelDefinition, options: CRUDOptions): RouteHandler {
    return {
      method: 'GET',
      path: options.basePath,
      handler: async (ctx: RequestContext) => {
        const { page = '1', limit = String(options.defaultPageSize || 20) } = ctx.query;
        
        const pageNum = parseInt(page, 10);
        const limitNum = Math.min(
          parseInt(limit, 10),
          options.maxPageSize || 100
        );

        const offset = (pageNum - 1) * limitNum;

        const results = await this.database
          .select(model)
          .limit(limitNum)
          .offset(offset)
          .execute();

        return new Response(
          JSON.stringify({
            data: results,
            pagination: {
              page: pageNum,
              limit: limitNum,
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
