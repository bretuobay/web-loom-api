/**
 * Migration Commands
 * 
 * Database migration management commands
 */

import { Command } from 'commander';
import { createCommand } from './create';
import { upCommand } from './up';
import { downCommand } from './down';
import { statusCommand } from './status';

export const migrateCommand = new Command('migrate')
  .description('Manage database migrations')
  .addCommand(createCommand)
  .addCommand(upCommand)
  .addCommand(downCommand)
  .addCommand(statusCommand);
