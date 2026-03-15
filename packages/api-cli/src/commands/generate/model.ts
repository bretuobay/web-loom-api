/**
 * Generate Model Command
 * 
 * Generates a model definition file with fields, relationships, and options.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { success, info, error as logError } from '../../utils/logger.js';
import { CLIError, wrapCommand } from '../../utils/error-handler.js';

/**
 * Field type options
 */
const FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'uuid',
  'enum',
  'json',
  'array',
  'decimal',
] as const;

/**
 * Relationship type options
 */
const RELATIONSHIP_TYPES = [
  'hasOne',
  'hasMany',
  'belongsTo',
  'manyToMany',
] as const;

/**
 * Field definition from CLI
 */
interface FieldSpec {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  default?: string;
}

/**
 * Relationship definition from CLI
 */
interface RelationshipSpec {
  type: string;
  model: string;
  foreignKey?: string;
}

/**
 * Model generation options
 */
interface GenerateModelOptions {
  fields?: string[];
  relationships?: string[];
  timestamps?: boolean;
  softDelete?: boolean;
  crud?: boolean;
  tableName?: string;
  output?: string;
}

/**
 * Parse field specification from string
 * Format: name:type[:required][:unique][:default=value]
 * Examples:
 *   - email:string:required:unique
 *   - age:number:default=0
 *   - isActive:boolean:default=true
 */
function parseFieldSpec(fieldStr: string): FieldSpec {
  const parts = fieldStr.split(':');
  
  if (parts.length < 2) {
    throw new CLIError(
      `Invalid field specification: "${fieldStr}". Expected format: name:type[:required][:unique][:default=value]`
    );
  }

  const name = parts[0];
  const type = parts[1];
  const modifiers = parts.slice(2);

  if (!name || !type) {
    throw new CLIError(
      `Invalid field specification: "${fieldStr}". Name and type are required.`
    );
  }

  if (!FIELD_TYPES.includes(type as typeof FIELD_TYPES[number])) {
    throw new CLIError(
      `Invalid field type: "${type}". Valid types: ${FIELD_TYPES.join(', ')}`
    );
  }

  const field: FieldSpec = { name, type };

  for (const modifier of modifiers) {
    if (modifier === 'required') {
      field.required = true;
    } else if (modifier === 'unique') {
      field.unique = true;
    } else if (modifier.startsWith('default=')) {
      field.default = modifier.substring(8);
    } else {
      throw new CLIError(
        `Invalid field modifier: "${modifier}". Valid modifiers: required, unique, default=value`
      );
    }
  }

  return field;
}

/**
 * Parse relationship specification from string
 * Format: type:model[:foreignKey]
 * Examples:
 *   - hasMany:Post
 *   - belongsTo:User:userId
 *   - manyToMany:Tag:through=PostTag
 */
function parseRelationshipSpec(relStr: string): RelationshipSpec {
  const parts = relStr.split(':');
  
  if (parts.length < 2) {
    throw new CLIError(
      `Invalid relationship specification: "${relStr}". Expected format: type:model[:foreignKey]`
    );
  }

  const type = parts[0];
  const model = parts[1];
  const foreignKey = parts[2];

  if (!type || !model) {
    throw new CLIError(
      `Invalid relationship specification: "${relStr}". Type and model are required.`
    );
  }

  if (!RELATIONSHIP_TYPES.includes(type as typeof RELATIONSHIP_TYPES[number])) {
    throw new CLIError(
      `Invalid relationship type: "${type}". Valid types: ${RELATIONSHIP_TYPES.join(', ')}`
    );
  }

  return {
    type: type as string,
    model: model as string,
    ...(foreignKey && { foreignKey }),
  };
}

/**
 * Convert field spec to TypeScript code
 */
function generateFieldCode(field: FieldSpec): string {
  const lines: string[] = [];
  
  lines.push(`  {`);
  lines.push(`    name: '${field.name}',`);
  lines.push(`    type: '${field.type}',`);
  
  if (field.required || field.unique || field.default !== undefined) {
    lines.push(`    validation: {`);
    if (field.required) {
      lines.push(`      required: true,`);
    }
    lines.push(`    },`);
  }
  
  if (field.unique || field.default !== undefined) {
    lines.push(`    database: {`);
    if (field.unique) {
      lines.push(`      unique: true,`);
    }
    if (field.default !== undefined) {
      // Try to parse as JSON for proper type
      let defaultValue = field.default;
      if (field.type === 'boolean') {
        defaultValue = field.default === 'true' ? 'true' : 'false';
      } else if (field.type === 'number') {
        defaultValue = field.default;
      } else {
        defaultValue = `'${field.default}'`;
      }
      lines.push(`      default: ${defaultValue},`);
    }
    lines.push(`    },`);
  }
  
  lines.push(`  },`);
  
  return lines.join('\n');
}

/**
 * Convert relationship spec to TypeScript code
 */
function generateRelationshipCode(rel: RelationshipSpec): string {
  const lines: string[] = [];
  
  lines.push(`  {`);
  lines.push(`    type: '${rel.type}',`);
  lines.push(`    model: '${rel.model}',`);
  
  if (rel.foreignKey) {
    lines.push(`    foreignKey: '${rel.foreignKey}',`);
  }
  
  lines.push(`  },`);
  
  return lines.join('\n');
}

/**
 * Generate model file content
 */
function generateModelContent(
  modelName: string,
  options: GenerateModelOptions
): string {
  const fields = options.fields?.map(parseFieldSpec) || [];
  const relationships = options.relationships?.map(parseRelationshipSpec) || [];
  
  const lines: string[] = [];
  
  // Imports
  lines.push(`import { defineModel } from '@web-loom/api-core';`);
  lines.push(``);
  
  // Model definition
  lines.push(`/**`);
  lines.push(` * ${modelName} Model`);
  lines.push(` * `);
  lines.push(` * Generated by Web Loom CLI`);
  lines.push(` */`);
  lines.push(`export const ${modelName} = defineModel({`);
  lines.push(`  name: '${modelName}',`);
  
  if (options.tableName) {
    lines.push(`  tableName: '${options.tableName}',`);
  }
  
  // Fields
  lines.push(`  fields: [`);
  
  // Add ID field by default
  lines.push(`    {`);
  lines.push(`      name: 'id',`);
  lines.push(`      type: 'uuid',`);
  lines.push(`      database: {`);
  lines.push(`        primaryKey: true,`);
  lines.push(`      },`);
  lines.push(`    },`);
  
  // Add custom fields
  for (const field of fields) {
    lines.push(generateFieldCode(field));
  }
  
  // Add timestamp fields if enabled
  if (options.timestamps !== false) {
    lines.push(`    {`);
    lines.push(`      name: 'createdAt',`);
    lines.push(`      type: 'date',`);
    lines.push(`      database: {`);
    lines.push(`        nullable: false,`);
    lines.push(`      },`);
    lines.push(`    },`);
    lines.push(`    {`);
    lines.push(`      name: 'updatedAt',`);
    lines.push(`      type: 'date',`);
    lines.push(`      database: {`);
    lines.push(`        nullable: false,`);
    lines.push(`      },`);
    lines.push(`    },`);
  }
  
  // Add deletedAt field if soft delete is enabled
  if (options.softDelete) {
    lines.push(`    {`);
    lines.push(`      name: 'deletedAt',`);
    lines.push(`      type: 'date',`);
    lines.push(`      database: {`);
    lines.push(`        nullable: true,`);
    lines.push(`      },`);
    lines.push(`    },`);
  }
  
  lines.push(`  ],`);
  
  // Relationships
  if (relationships.length > 0) {
    lines.push(`  relationships: [`);
    for (const rel of relationships) {
      lines.push(generateRelationshipCode(rel));
    }
    lines.push(`  ],`);
  }
  
  // Options
  const hasOptions = options.timestamps !== false || options.softDelete || options.crud;
  if (hasOptions) {
    lines.push(`  options: {`);
    
    if (options.timestamps !== false) {
      lines.push(`    timestamps: true,`);
    }
    
    if (options.softDelete) {
      lines.push(`    softDelete: true,`);
    }
    
    if (options.crud) {
      lines.push(`    crud: true,`);
    }
    
    lines.push(`  },`);
  }
  
  lines.push(`});`);
  lines.push(``);
  
  return lines.join('\n');
}

/**
 * Get model file path
 */
function getModelFilePath(modelName: string, outputDir?: string): string {
  const fileName = `${modelName.toLowerCase()}.ts`;
  
  if (outputDir) {
    return path.join(outputDir, fileName);
  }
  
  // Default to src/models directory
  return path.join(process.cwd(), 'src', 'models', fileName);
}

/**
 * Generate model command handler
 */
async function generateModelCommand(
  modelName: string,
  options: GenerateModelOptions
): Promise<void> {
  try {
    // Validate model name
    if (!modelName || !/^[A-Z][a-zA-Z0-9]*$/.test(modelName)) {
      throw new CLIError(
        'Model name must start with an uppercase letter and contain only alphanumeric characters'
      );
    }

    info(`Generating model: ${modelName}...\n`);

    // Generate model content
    const content = generateModelContent(modelName, options);

    // Get output path
    const filePath = getModelFilePath(modelName, options.output);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Check if file already exists
    try {
      await fs.access(filePath);
      throw new CLIError(
        `Model file already exists: ${filePath}\nUse --force to overwrite (not implemented yet)`
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
        throw err;
      }
    }

    // Write file
    await fs.writeFile(filePath, content);

    success(`\nModel generated successfully!`);
    info(`  File: ${filePath}`);
    
    if (options.crud) {
      info(`\nNext steps:`);
      info(`  1. Review and customize the model definition`);
      info(`  2. Run: webloom generate crud ${modelName}`);
      info(`  3. Run: webloom migrate create`);
    } else {
      info(`\nNext steps:`);
      info(`  1. Review and customize the model definition`);
      info(`  2. Run: webloom migrate create`);
    }
  } catch (err) {
    if (err instanceof CLIError) {
      throw err;
    }
    logError(`Failed to generate model: ${err}`);
    throw new CLIError('Model generation failed');
  }
}

/**
 * Create generate model command
 */
export function createGenerateModelCommand(): Command {
  return new Command('model')
    .description('Generate a model definition file')
    .argument('<name>', 'Model name (PascalCase)')
    .option(
      '-f, --fields <fields...>',
      'Field definitions (format: name:type[:required][:unique][:default=value])'
    )
    .option(
      '-r, --relationships <relationships...>',
      'Relationship definitions (format: type:model[:foreignKey])'
    )
    .option('--no-timestamps', 'Disable automatic timestamp fields')
    .option('--soft-delete', 'Enable soft delete support')
    .option('--crud', 'Enable CRUD generation')
    .option('--table-name <name>', 'Custom database table name')
    .option('-o, --output <dir>', 'Output directory (default: src/models)')
    .action(wrapCommand(generateModelCommand));
}
