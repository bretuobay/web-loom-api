/**
 * Generate Commands
 * 
 * Code generation commands for models, routes, and CRUD endpoints.
 */

import { Command } from 'commander';
import { createGenerateModelCommand } from './model.js';
import { createGenerateCRUDCommand } from './crud.js';

/**
 * Create generate command with subcommands
 */
export function createGenerateCommand(): Command {
  const generate = new Command('generate')
    .alias('g')
    .description('Generate code (models, routes, CRUD)');

  // Add subcommands
  generate.addCommand(createGenerateModelCommand());
  generate.addCommand(createGenerateCRUDCommand());
  // generate.addCommand(createGenerateRouteCommand());

  return generate;
}
