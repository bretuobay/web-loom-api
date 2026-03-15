/**
 * Web Loom CLI Program Configuration
 * 
 * Configures the Commander.js program with all commands,
 * global options, and help text.
 */

import { Command } from 'commander';
import { CLI_VERSION } from './version.js';

/**
 * Create and configure the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('webloom')
    .description('Web Loom API Framework - Build production-ready REST APIs')
    .version(CLI_VERSION, '-v, --version', 'Display version number')
    .helpOption('-h, --help', 'Display help for command');

  // Global options
  program
    .option('--debug', 'Enable debug mode with verbose logging')
    .option('--config <path>', 'Path to configuration file', 'webloom.config.ts')
    .option('--no-color', 'Disable colored output');

  // Add commands (will be implemented in subsequent tasks)
  // program.addCommand(initCommand);
  // program.addCommand(generateCommand);
  // program.addCommand(migrateCommand);
  // program.addCommand(devCommand);
  // program.addCommand(seedCommand);

  // Show help if no command provided
  if (process.argv.length === 2) {
    program.outputHelp();
  }

  return program;
}

/**
 * Singleton program instance
 */
export const program = createProgram();
