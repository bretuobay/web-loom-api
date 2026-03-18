/**
 * Generate Client Command
 *
 * Generates a typed TypeScript fetch client from an OpenAPI 3.1 document
 * (--input) or falls back to scanning src/routes when no input file is found.
 * The generated client uses the native fetch API with zero runtime deps.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

// ── OpenAPI document shape (minimal) ─────────────────────────────────────────

interface OAOperation {
  operationId?: string;
}

interface OAPathItem {
  get?: OAOperation;
  post?: OAOperation;
  put?: OAOperation;
  patch?: OAOperation;
  delete?: OAOperation;
}

interface OADocument {
  openapi: string;
  paths?: Record<string, OAPathItem>;
}

// ── Route discovery ───────────────────────────────────────────────────────────

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function filePathToUrlPath(relativePath: string): string {
  let urlPath = relativePath
    .replace(/\.(ts|js|tsx|jsx)$/, '')
    .replace(/\\/g, '/')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  if (!urlPath.startsWith('/')) urlPath = `/${urlPath}`;
  if (urlPath !== '/' && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
  return urlPath || '/';
}

function readExportedMethods(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const found = HTTP_METHODS.filter((m) =>
      new RegExp(`export\\s+(const|function|async)\\s+${m}\\b`).test(content)
    );
    return found.length > 0 ? found : ['GET'];
  } catch {
    return ['GET'];
  }
}

interface RouteInfo {
  method: string;
  path: string;
  operationId: string;
  pathParams: string[];
}

function extractPathParams(urlPath: string): string[] {
  return (urlPath.match(/:(\w+)/g) ?? []).map((p) => p.slice(1));
}

function buildOperationId(method: string, urlPath: string): string {
  const segments = urlPath
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        return 'By' + seg[1]!.toUpperCase() + seg.slice(2);
      }
      return seg[0]!.toUpperCase() + seg.slice(1);
    });
  if (segments.length === 0) segments.push('Index');
  return method.toLowerCase() + segments.join('');
}

function discoverRoutes(routesDir: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  if (!fs.existsSync(routesDir)) return routes;

  const scan = (dir: string): void => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        scan(full);
      } else if (item.isFile() && /\.(ts|js|tsx|jsx)$/.test(item.name)) {
        const rel = path.relative(routesDir, full);
        const urlPath = filePathToUrlPath(rel);
        const methods = readExportedMethods(full);
        for (const method of methods) {
          routes.push({
            method,
            path: urlPath,
            operationId: buildOperationId(method, urlPath),
            pathParams: extractPathParams(urlPath),
          });
        }
      }
    }
  };

  scan(routesDir);
  return routes;
}

function routesFromDocument(doc: OADocument): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [oaPath, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const httpMethod of httpMethods) {
      const op = pathItem[httpMethod];
      if (!op) continue;
      const honoPath = oaPath.replace(/\{(\w+)\}/g, ':$1');
      const operationId = op.operationId ?? buildOperationId(httpMethod.toUpperCase(), honoPath);
      routes.push({
        method: httpMethod.toUpperCase(),
        path: honoPath,
        operationId,
        pathParams: extractPathParams(honoPath),
      });
    }
  }

  return routes;
}

// ── Code generation ───────────────────────────────────────────────────────────

function generateTypesFile(): string {
  return `/**
 * Generated API types — DO NOT EDIT
 */

export interface ApiError {
  error: { code: string; message: string };
}

export interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  baseUrl?: string;
}
`;
}

function generateUtilsFile(): string {
  return `/**
 * Generated request utilities — DO NOT EDIT
 */

export async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const body = JSON.parse(text) as { error?: { message?: string } };
      message = body?.error?.message ?? text;
    } catch { /* not JSON */ }
    throw new Error(\`HTTP \${res.status}: \${message}\`);
  }
  if (!text) return undefined as unknown as T;
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}
`;
}

function generateErrorsFile(): string {
  return `/**
 * Generated error classes — DO NOT EDIT
 */

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}
`;
}

function generateHooksFile(className: string): string {
  return `/**
 * Generated React hooks stub — DO NOT EDIT
 * Wire up ${className} to build real hooks.
 */
export type {};
`;
}

function generateClientMethod(route: RouteInfo): string {
  const { method, path: routePath, operationId, pathParams } = route;
  const fetchPath = routePath.replace(/:(\w+)/g, (_: string, p: string) => `\${${p}}`);
  const paramArgs = pathParams.map((p) => `${p}: string`).join(', ');
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
  const bodyArg = hasBody ? (paramArgs ? ', body: unknown' : 'body: unknown') : '';
  const args = [paramArgs, bodyArg, 'options?: RequestOptions']
    .filter(Boolean)
    .join(', ');
  const bodyPart = hasBody ? '\n      body: JSON.stringify(body),' : '';

  return `
  async ${operationId}(${args}): Promise<unknown> {
    const { baseUrl: urlOverride, ...fetchOpts } = options ?? {};
    const base = urlOverride ?? this.baseUrl;
    const url = \`\${base.replace(/\\/$/, '')}${fetchPath}\`;
    const res = await fetch(url, {
      method: '${method}',
      headers: { 'Content-Type': 'application/json', ...fetchOpts.headers },${bodyPart}
      ...fetchOpts,
    });
    return parseResponse(res);
  }`;
}

function generateClientFile(className: string, baseUrl: string, routes: RouteInfo[]): string {
  const methods = routes.map(generateClientMethod).join('\n');
  return `/**
 * Generated API client — DO NOT EDIT
 */

import { parseResponse } from './utils.js';
import type { RequestOptions } from './types.js';

const DEFAULT_BASE_URL = '${baseUrl}';

export class ${className} {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }
${methods}
}
`;
}

function generateIndexFile(includeErrors: boolean, includeHooks: boolean): string {
  const lines = [
    "export * from './types';",
    "export * from './utils';",
    "export * from './client';",
  ];
  if (includeErrors) lines.push("export * from './errors';");
  if (includeHooks) lines.push("export * from './hooks';");
  return `/**\n * Generated API client entry — DO NOT EDIT\n */\n\n${lines.join('\n')}\n`;
}

// ── Command ───────────────────────────────────────────────────────────────────

export const createGenerateClientCommand = (): Command => {
  return new Command('client')
    .description('Generate a typed TypeScript fetch client')
    .option('-i, --input <path>', 'Path to OpenAPI JSON file (uses ./openapi.json if it exists)')
    .option('-o, --output <path>', 'Output directory', 'src/client')
    .option('--base-url <url>', 'Default base URL baked into the client', '')
    .option('--class-name <name>', 'Client class name', 'ApiClient')
    .option('--routes-dir <dir>', 'Routes directory for fallback discovery', 'src/routes')
    .option('--no-hooks', 'Skip generating React hooks stub')
    .option('--no-errors', 'Skip generating error classes')
    .action(
      async (options: {
        input?: string;
        output: string;
        baseUrl: string;
        className: string;
        routesDir: string;
        hooks: boolean;
        errors: boolean;
      }) => {
        try {
          const projectRoot = process.cwd();

          // Resolve routes from OpenAPI file or route discovery
          let routes: RouteInfo[];
          const inputPath = options.input
            ? path.resolve(projectRoot, options.input)
            : path.join(projectRoot, 'openapi.json');

          if (fs.existsSync(inputPath)) {
            const raw = fs.readFileSync(inputPath, 'utf-8');
            routes = routesFromDocument(JSON.parse(raw) as OADocument);
          } else {
            const routesDir = path.isAbsolute(options.routesDir)
              ? options.routesDir
              : path.join(projectRoot, options.routesDir);
            routes = discoverRoutes(routesDir);
          }

          const outputDir = path.isAbsolute(options.output)
            ? options.output
            : path.join(projectRoot, options.output);

          if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

          const files: Array<{ name: string; content: string }> = [
            { name: 'types.ts', content: generateTypesFile() },
            { name: 'utils.ts', content: generateUtilsFile() },
            { name: 'client.ts', content: generateClientFile(options.className, options.baseUrl, routes) },
          ];
          if (options.errors) files.push({ name: 'errors.ts', content: generateErrorsFile() });
          if (options.hooks) files.push({ name: 'hooks.ts', content: generateHooksFile(options.className) });
          files.push({ name: 'index.ts', content: generateIndexFile(options.errors, options.hooks) });

          for (const file of files) {
            fs.writeFileSync(path.join(outputDir, file.name), file.content, 'utf-8');
          }

          const relOut = path.relative(projectRoot, outputDir);
          console.log(`Client generated in ${relOut}/`);
          console.log(`  Class:  ${options.className}`);
          console.log(`  Routes: ${routes.length}`);
          console.log(`  Files:  ${files.map((f) => f.name).join(', ')}`);
        } catch (error) {
          console.error('Error generating client:', error instanceof Error ? error.message : error);
          process.exit(1);
        }
      }
    );
};
