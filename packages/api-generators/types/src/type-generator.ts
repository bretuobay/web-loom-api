/**
 * TypeScript Type Generator
 * 
 * Generates TypeScript types from model definitions
 */

import type {
  TypeGeneratorOptions,
  GeneratedTypes,
  ModelDefinition,
  EnumDefinition,
  RouteDefinition,
  FieldDefinition,
} from './types';

/**
 * TypeScript Type Generator Class
 */
export class TypeGenerator {
  private models: Map<string, ModelDefinition> = new Map();
  private enums: Map<string, EnumDefinition> = new Map();
  private routes: RouteDefinition[] = [];
  private options: Required<TypeGeneratorOptions>;

  constructor(options: TypeGeneratorOptions = {}) {
    this.options = {
      includeJSDoc: options.includeJSDoc ?? true,
      generateEnums: options.generateEnums ?? true,
      generateRequestResponseTypes: options.generateRequestResponseTypes ?? true,
      exportFormat: options.exportFormat || 'esm',
      readonly: options.readonly ?? false,
      generateUtilityTypes: options.generateUtilityTypes ?? true,
    };
  }

  /**
   * Register a model definition
   */
  registerModel(model: ModelDefinition): void {
    this.models.set(model.name, model);
  }

  /**
   * Register multiple model definitions
   */
  registerModels(models: ModelDefinition[]): void {
    for (const model of models) {
      this.registerModel(model);
    }
  }

  /**
   * Register an enum definition
   */
  registerEnum(enumDef: EnumDefinition): void {
    this.enums.set(enumDef.name, enumDef);
  }

  /**
   * Register multiple enum definitions
   */
  registerEnums(enums: EnumDefinition[]): void {
    for (const enumDef of enums) {
      this.registerEnum(enumDef);
    }
  }

  /**
   * Register a route definition
   */
  registerRoute(route: RouteDefinition): void {
    this.routes.push(route);
  }

  /**
   * Register multiple route definitions
   */
  registerRoutes(routes: RouteDefinition[]): void {
    this.routes.push(...routes);
  }

  /**
   * Generate all types
   */
  generate(): GeneratedTypes {
    const result: GeneratedTypes = {
      models: this.generateModelTypes(),
    };

    if (this.options.generateEnums && this.enums.size > 0) {
      result.enums = this.generateEnumTypes();
    }

    if (this.options.generateRequestResponseTypes && this.routes.length > 0) {
      result.requestResponse = this.generateRequestResponseTypes();
    }

    if (this.options.generateUtilityTypes) {
      result.utils = this.generateUtilityTypes();
    }

    return result;
  }

  /**
   * Generate model types
   */
  private generateModelTypes(): string {
    const lines: string[] = [];

    lines.push('/**');
    lines.push(' * Generated Model Types');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    for (const [name, model] of this.models) {
      // JSDoc comment
      if (this.options.includeJSDoc && model.metadata?.description) {
        lines.push('/**');
        lines.push(` * ${model.metadata.description}`);
        if (model.metadata.tableName) {
          lines.push(` * @table ${model.metadata.tableName}`);
        }
        lines.push(' */');
      }

      // Interface
      lines.push(`export interface ${name} {`);

      for (const field of model.fields) {
        // Field JSDoc
        if (this.options.includeJSDoc && field.metadata?.description) {
          lines.push('  /**');
          lines.push(`   * ${field.metadata.description}`);
          if (field.metadata.example !== undefined) {
            lines.push(`   * @example ${JSON.stringify(field.metadata.example)}`);
          }
          if (field.metadata.deprecated) {
            lines.push('   * @deprecated');
          }
          lines.push('   */');
        }

        const optional = !field.required;
        const readonly = this.options.readonly ? 'readonly ' : '';
        const tsType = this.fieldTypeToTS(field);
        
        lines.push(`  ${readonly}${field.name}${optional ? '?' : ''}: ${tsType};`);
      }

      lines.push('}');
      lines.push('');

      // Generate Create type (without id, timestamps)
      lines.push(`/**`);
      lines.push(` * Create input for ${name}`);
      lines.push(` */`);
      lines.push(`export type Create${name} = Omit<${name}, 'id'${model.metadata?.timestamps ? " | 'createdAt' | 'updatedAt'" : ''}>;`);
      lines.push('');

      // Generate Update type (all fields optional except id)
      lines.push(`/**`);
      lines.push(` * Update input for ${name}`);
      lines.push(` */`);
      lines.push(`export type Update${name} = Partial<Omit<${name}, 'id'${model.metadata?.timestamps ? " | 'createdAt'" : ''}>>;`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate enum types
   */
  private generateEnumTypes(): string {
    const lines: string[] = [];

    lines.push('/**');
    lines.push(' * Generated Enum Types');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    for (const [name, enumDef] of this.enums) {
      // JSDoc comment
      if (this.options.includeJSDoc && enumDef.metadata?.description) {
        lines.push('/**');
        lines.push(` * ${enumDef.metadata.description}`);
        lines.push(' */');
      }

      lines.push(`export enum ${name} {`);

      for (const value of enumDef.values) {
        if (this.options.includeJSDoc && value.description) {
          lines.push('  /**');
          lines.push(`   * ${value.description}`);
          lines.push('   */');
        }

        const enumValue = typeof value.value === 'string' ? `'${value.value}'` : value.value;
        lines.push(`  ${value.key} = ${enumValue},`);
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate request/response types
   */
  private generateRequestResponseTypes(): string {
    const lines: string[] = [];

    lines.push('/**');
    lines.push(' * Generated Request/Response Types');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    // Generic response wrapper
    lines.push('/**');
    lines.push(' * API Response wrapper');
    lines.push(' */');
    lines.push('export interface APIResponse<T = unknown> {');
    lines.push('  data: T;');
    lines.push('  status: number;');
    lines.push('  message?: string;');
    lines.push('}');
    lines.push('');

    // Error response
    lines.push('/**');
    lines.push(' * API Error response');
    lines.push(' */');
    lines.push('export interface APIErrorResponse {');
    lines.push('  error: {');
    lines.push('    code: string;');
    lines.push('    message: string;');
    lines.push('    details?: unknown;');
    lines.push('    timestamp: string;');
    lines.push('    requestId: string;');
    lines.push('    path?: string;');
    lines.push('  };');
    lines.push('}');
    lines.push('');

    // Pagination
    lines.push('/**');
    lines.push(' * Pagination metadata');
    lines.push(' */');
    lines.push('export interface PaginationMeta {');
    lines.push('  page: number;');
    lines.push('  limit: number;');
    lines.push('  total: number;');
    lines.push('  totalPages: number;');
    lines.push('}');
    lines.push('');

    lines.push('/**');
    lines.push(' * Paginated response');
    lines.push(' */');
    lines.push('export interface PaginatedResponse<T> {');
    lines.push('  data: T[];');
    lines.push('  pagination: PaginationMeta;');
    lines.push('}');
    lines.push('');

    // Query parameters
    lines.push('/**');
    lines.push(' * List query parameters');
    lines.push(' */');
    lines.push('export interface ListQueryParams {');
    lines.push('  page?: number;');
    lines.push('  limit?: number;');
    lines.push('  sort?: string;');
    lines.push('  order?: "asc" | "desc";');
    lines.push('  search?: string;');
    lines.push('  [key: string]: unknown;');
    lines.push('}');
    lines.push('');

    // Generate route-specific types
    const generatedTypes = new Set<string>();

    for (const route of this.routes) {
      const modelName = this.inferModelFromPath(route.path);
      if (!modelName || !this.models.has(modelName)) continue;

      const typeName = `${modelName}${this.capitalize(route.method)}`;
      
      if (generatedTypes.has(typeName)) continue;
      generatedTypes.add(typeName);

      // Request type
      if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
        lines.push(`/**`);
        lines.push(` * ${route.method} ${route.path} request body`);
        lines.push(` */`);
        
        if (route.method === 'POST') {
          lines.push(`export type ${typeName}Request = Create${modelName};`);
        } else {
          lines.push(`export type ${typeName}Request = Update${modelName};`);
        }
        lines.push('');
      }

      // Response type
      lines.push(`/**`);
      lines.push(` * ${route.method} ${route.path} response`);
      lines.push(` */`);
      
      if (route.method === 'GET' && !route.path.includes(':')) {
        lines.push(`export type ${typeName}Response = PaginatedResponse<${modelName}>;`);
      } else if (route.method === 'DELETE') {
        lines.push(`export type ${typeName}Response = void;`);
      } else {
        lines.push(`export type ${typeName}Response = ${modelName};`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate utility types
   */
  private generateUtilityTypes(): string {
    const lines: string[] = [];

    lines.push('/**');
    lines.push(' * Generated Utility Types');
    lines.push(' * ');
    lines.push(' * DO NOT EDIT - This file is auto-generated');
    lines.push(' */');
    lines.push('');

    lines.push('/**');
    lines.push(' * Make all properties optional recursively');
    lines.push(' */');
    lines.push('export type DeepPartial<T> = {');
    lines.push('  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];');
    lines.push('};');
    lines.push('');

    lines.push('/**');
    lines.push(' * Make all properties required recursively');
    lines.push(' */');
    lines.push('export type DeepRequired<T> = {');
    lines.push('  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];');
    lines.push('};');
    lines.push('');

    lines.push('/**');
    lines.push(' * Make all properties readonly recursively');
    lines.push(' */');
    lines.push('export type DeepReadonly<T> = {');
    lines.push('  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];');
    lines.push('};');
    lines.push('');

    lines.push('/**');
    lines.push(' * Prettify type for better IDE display');
    lines.push(' */');
    lines.push('export type Prettify<T> = {');
    lines.push('  [K in keyof T]: T[K];');
    lines.push('} & {};');
    lines.push('');

    lines.push('/**');
    lines.push(' * Extract keys of type T that are of type U');
    lines.push(' */');
    lines.push('export type KeysOfType<T, U> = {');
    lines.push('  [K in keyof T]: T[K] extends U ? K : never;');
    lines.push('}[keyof T];');
    lines.push('');

    lines.push('/**');
    lines.push(' * Make specific keys optional');
    lines.push(' */');
    lines.push('export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;');
    lines.push('');

    lines.push('/**');
    lines.push(' * Make specific keys required');
    lines.push(' */');
    lines.push('export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Convert field type to TypeScript type
   */
  private fieldTypeToTS(field: FieldDefinition): string {
    switch (field.type) {
      case 'string':
      case 'uuid':
        return 'string';
      
      case 'number':
      case 'decimal':
        return 'number';
      
      case 'boolean':
        return 'boolean';
      
      case 'date':
        return 'Date';
      
      case 'enum':
        if (field.enum && field.enum.length > 0) {
          return field.enum.map(v => `'${v}'`).join(' | ');
        }
        return 'string';
      
      case 'json':
        return 'Record<string, unknown>';
      
      case 'array':
        if (field.arrayItemType) {
          const itemType = this.fieldTypeToTS({ ...field, type: field.arrayItemType });
          return `${itemType}[]`;
        }
        return 'unknown[]';
      
      default:
        return 'unknown';
    }
  }

  /**
   * Infer model name from route path
   */
  private inferModelFromPath(path: string): string | null {
    const parts = path.split('/').filter(Boolean);
    
    for (const part of parts) {
      if (!part.startsWith(':') && !part.match(/^(api|v\d+)$/i)) {
        const singular = part.endsWith('s') ? part.slice(0, -1) : part;
        return this.capitalize(singular);
      }
    }
    
    return null;
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate all files
   */
  generateToFiles(): Map<string, string> {
    const files = new Map<string, string>();
    const generated = this.generate();

    files.set('models.ts', generated.models);

    if (generated.enums) {
      files.set('enums.ts', generated.enums);
    }

    if (generated.requestResponse) {
      files.set('api.ts', generated.requestResponse);
    }

    if (generated.utils) {
      files.set('utils.ts', generated.utils);
    }

    // Generate index file
    const indexLines: string[] = [];
    indexLines.push('/**');
    indexLines.push(' * Generated Types');
    indexLines.push(' * ');
    indexLines.push(' * DO NOT EDIT - This file is auto-generated');
    indexLines.push(' */');
    indexLines.push('');
    indexLines.push(`export * from './models';`);
    
    if (generated.enums) {
      indexLines.push(`export * from './enums';`);
    }
    
    if (generated.requestResponse) {
      indexLines.push(`export * from './api';`);
    }
    
    if (generated.utils) {
      indexLines.push(`export * from './utils';`);
    }
    
    indexLines.push('');

    files.set('index.ts', indexLines.join('\n'));

    return files;
  }
}
