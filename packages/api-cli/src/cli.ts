#!/usr/bin/env node

/**
 * Web Loom CLI Entry Point
 * 
 * Main entry point for the webloom command-line tool.
 * Provides commands for project initialization, code generation,
 * database migrations, and development server.
 */

import { program } from './program.js';

// Parse command line arguments and execute
program.parse(process.argv);
