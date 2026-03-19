/**
 * Generate Route Command
 *
 * Generates route files with HTTP method handlers and validation schema stubs.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { success, info, error as logError } from '../../utils/logger.js';
import { CLIError, wrapCommand } from '../../utils/error-handler.js';

/**
 * HTTP methods supported
 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;
type HTTPMethod = (typeof HTTP_METHODS)[number];

/**
 * Route generation options
 */
interface GenerateRouteOptions {
  methods?: string[];
  validation?: boolean;
  auth?: boolean;
  output?: string;
}

/**
 * Parse route path to extract dynamic segments
 * Examples:
 *   /users -> /users
 *   /users/:id -> /users/[id]
 *   /posts/:postId/comments/:id -> /posts/[postId]/comments/[id]
 */
function parseRoutePath(routePath: string): {
  filePath: string;
  urlPath: string;
  params: string[];
} {
  const params: string[] = [];

  // Extract parameters from :param format
  const urlPath = routePath;
  const filePath = routePath.replace(/:([a-zA-Z0-9_]+)/g, (_, param) => {
    params.push(param);
    return `[${param}]`;
  });

  return { filePath, urlPath, params };
}

/**
 * Generate validation schema stub
 */
function generateValidationSchema(methods: HTTPMethod[], params: string[]): string {
  const lines: string[] = [];
  const hasBodyMethods = methods.some((m) => m === 'POST' || m === 'PUT' || m === 'PATCH');
  const hasGetMethod = methods.includes('GET');

  if (hasBodyMethods) {
    lines.push(`/**`);
    lines.push(` * Request body validation schema`);
    lines.push(` */`);
    lines.push(`const bodySchema = z.object({`);
    lines.push(`  // TODO: Add your validation rules`);
    lines.push(`  // example: z.string().min(1).max(100),`);
    lines.push(`});`);
    lines.push(``);
  }

  if (params.length > 0) {
    lines.push(`/**`);
    lines.push(` * Path parameters validation schema`);
    lines.push(` */`);
    lines.push(`const paramsSchema = z.object({`);
    for (const param of params) {
      lines.push(`  ${param}: z.string().uuid(), // TODO: Adjust validation as needed`);
    }
    lines.push(`});`);
    lines.push(``);
  }

  if (hasGetMethod) {
    lines.push(`/**`);
    lines.push(` * Query parameters validation schema`);
    lines.push(` */`);
    lines.push(`const querySchema = z.object({`);
    lines.push(`  // TODO: Add query parameter validation`);
    lines.push(`  // page: z.coerce.number().int().positive().optional(),`);
    lines.push(`  // limit: z.coerce.number().int().positive().max(100).optional(),`);
    lines.push(`});`);
    lines.push(``);
  }

  return lines.join('\n');
}

/**
 * Generate HTTP method handler
 */
function generateMethodHandler(
  method: HTTPMethod,
  urlPath: string,
  params: string[],
  options: GenerateRouteOptions
): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * ${method} ${urlPath}`);
  lines.push(` */`);
  lines.push(
    `export async function ${method}(ctx: RequestContext, next: NextFunction): Promise<Response> {`
  );

  if (options.auth) {
    lines.push(`  // TODO: Check authentication`);
    lines.push(`  // if (!ctx.user) {`);
    lines.push(`  //   return new Response(JSON.stringify({ error: 'Unauthorized' }), {`);
    lines.push(`  //     status: 401,`);
    lines.push(`  //     headers: { 'Content-Type': 'application/json' },`);
    lines.push(`  //   });`);
    lines.push(`  // }`);
    lines.push(``);
  }

  if (options.validation) {
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      lines.push(`  // Validate request body`);
      lines.push(`  const body = await ctx.request.json();`);
      lines.push(`  const validatedBody = bodySchema.parse(body);`);
      lines.push(``);
    }

    if (params.length > 0) {
      lines.push(`  // Validate path parameters`);
      lines.push(`  const validatedParams = paramsSchema.parse(ctx.params);`);
      lines.push(``);
    }

    if (method === 'GET') {
      lines.push(`  // Validate query parameters`);
      lines.push(`  const url = new URL(ctx.request.url);`);
      lines.push(`  const query = Object.fromEntries(url.searchParams);`);
      lines.push(`  const validatedQuery = querySchema.parse(query);`);
      lines.push(``);
    }
  }

  lines.push(`  // TODO: Implement your business logic here`);
  lines.push(``);

  // Generate response based on method
  if (method === 'GET') {
    lines.push(`  return new Response(`);
    lines.push(`    JSON.stringify({`);
    lines.push(`      message: 'GET request successful',`);
    if (params.length > 0) {
      lines.push(`      params: ctx.params,`);
    }
    lines.push(`    }),`);
    lines.push(`    {`);
    lines.push(`      status: 200,`);
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push(`    }`);
    lines.push(`  );`);
  } else if (method === 'POST') {
    lines.push(`  return new Response(`);
    lines.push(`    JSON.stringify({`);
    lines.push(`      message: 'Resource created successfully',`);
    lines.push(`      // data: createdResource,`);
    lines.push(`    }),`);
    lines.push(`    {`);
    lines.push(`      status: 201,`);
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push(`    }`);
    lines.push(`  );`);
  } else if (method === 'PUT' || method === 'PATCH') {
    lines.push(`  return new Response(`);
    lines.push(`    JSON.stringify({`);
    lines.push(`      message: 'Resource updated successfully',`);
    lines.push(`      // data: updatedResource,`);
    lines.push(`    }),`);
    lines.push(`    {`);
    lines.push(`      status: 200,`);
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push(`    }`);
    lines.push(`  );`);
  } else if (method === 'DELETE') {
    lines.push(`  return new Response(`);
    lines.push(`    JSON.stringify({`);
    lines.push(`      message: 'Resource deleted successfully',`);
    lines.push(`    }),`);
    lines.push(`    {`);
    lines.push(`      status: 200,`);
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push(`    }`);
    lines.push(`  );`);
  } else {
    lines.push(`  return new Response(`);
    lines.push(`    JSON.stringify({ message: '${method} request successful' }),`);
    lines.push(`    {`);
    lines.push(`      status: 200,`);
    lines.push(`      headers: { 'Content-Type': 'application/json' },`);
    lines.push(`    }`);
    lines.push(`  );`);
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Generate route file content
 */
function generateRouteContent(
  urlPath: string,
  methods: HTTPMethod[],
  params: string[],
  options: GenerateRouteOptions
): string {
  const lines: string[] = [];

  // Imports
  lines.push(`import type { RequestContext, NextFunction } from '@web-loom/api-core';`);

  if (options.validation) {
    lines.push(`import { z } from 'zod';`);
  }

  lines.push(``);

  // Add validation schemas if enabled (generate once for all methods)
  if (options.validation) {
    const schema = generateValidationSchema(methods, params);
    if (schema) {
      lines.push(schema);
    }
  }

  // Generate handlers for each method
  for (const method of methods) {
    lines.push(generateMethodHandler(method, urlPath, params, options));
    lines.push(``);
  }

  // Remove last empty line
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.push(``);

  return lines.join('\n');
}

/**
 * Get route file path
 */
function getRouteFilePath(filePath: string, outputDir?: string): string {
  // Remove leading slash
  const cleanPath = filePath.replace(/^\//, '');

  // Convert to file path
  const fileName = cleanPath ? `${cleanPath}.ts` : 'index.ts';

  if (outputDir) {
    return path.join(outputDir, fileName);
  }

  // Default to src/routes directory
  return path.join(process.cwd(), 'src', 'routes', fileName);
}

/**
 * Generate route command handler
 */
async function generateRouteCommand(
  routePath: string,
  options: GenerateRouteOptions
): Promise<void> {
  try {
    // Validate route path
    if (!routePath) {
      throw new CLIError('Route path is required');
    }

    if (!routePath.startsWith('/')) {
      throw new CLIError('Route path must start with /');
    }

    info(`Generating route: ${routePath}...\n`);

    // Parse route path
    const { filePath, urlPath, params } = parseRoutePath(routePath);

    // Parse methods
    let methods: HTTPMethod[] = ['GET'];
    if (options.methods && options.methods.length > 0) {
      const upperMethods = options.methods.map((m) => m.toUpperCase());

      // Validate methods
      for (const method of upperMethods) {
        if (!(HTTP_METHODS as readonly string[]).includes(method)) {
          throw new CLIError(
            `Invalid HTTP method: ${method}. Valid methods: ${HTTP_METHODS.join(', ')}`
          );
        }
      }

      methods = upperMethods as HTTPMethod[];
    }

    // Generate route content
    const content = generateRouteContent(urlPath, methods, params, options);

    // Get output path
    const outputPath = getRouteFilePath(filePath, options.output);
    const dir = path.dirname(outputPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(outputPath);
      throw new CLIError(
        `Route file already exists: ${outputPath}\nUse --force to overwrite (not implemented yet)`
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
        throw err;
      }
    }

    // Write file
    await fs.writeFile(outputPath, content);

    success(`\nRoute generated successfully!`);
    info(`  File: ${outputPath}`);
    info(`  URL: ${urlPath}`);
    info(`  Methods: ${methods.join(', ')}`);

    if (params.length > 0) {
      info(`  Parameters: ${params.join(', ')}`);
    }

    info(`\nNext steps:`);
    info(`  1. Implement the business logic in the generated handlers`);
    if (options.validation) {
      info(`  2. Customize the validation schemas`);
    }
    info(`  ${options.validation ? '3' : '2'}. Run: webloom dev`);
  } catch (err) {
    if (err instanceof CLIError) {
      throw err;
    }
    logError(`Failed to generate route: ${err}`);
    throw new CLIError('Route generation failed');
  }
}

/**
 * Create generate route command
 */
export function createGenerateRouteCommand(): Command {
  return new Command('route')
    .description('Generate a route file with HTTP method handlers')
    .argument('<path>', 'Route path (e.g., /users, /posts/:id)')
    .option('-m, --methods <methods...>', 'HTTP methods to generate (default: GET)', ['GET'])
    .option('--validation', 'Add validation schema stubs')
    .option('--auth', 'Add authentication check stubs')
    .option('-o, --output <dir>', 'Output directory (default: src/routes)')
    .action(wrapCommand(generateRouteCommand));
}
