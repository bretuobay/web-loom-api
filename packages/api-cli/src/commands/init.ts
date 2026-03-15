/**
 * Init Command
 * 
 * Initializes a new Web Loom API project with interactive prompts.
 * Creates project structure, configuration files, and installs dependencies.
 */

import { Command } from 'commander';
import prompts from 'prompts';
import * as fs from 'fs/promises';
import * as path from 'path';
import { success, info, withSpinner } from '../utils/logger.js';
import { CLIError, wrapCommand } from '../utils/error-handler.js';
import { copyTemplate, type TemplateType as LoaderTemplateType } from '../utils/template-loader.js';

/**
 * Project template types
 */
export type TemplateType = LoaderTemplateType;

/**
 * Project initialization options
 */
export interface InitOptions {
  name?: string;
  template?: TemplateType;
  skipInstall?: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

/**
 * Project configuration
 */
interface ProjectConfig {
  name: string;
  template: TemplateType;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  directory: string;
}

/**
 * Prompt user for project configuration
 */
async function promptForConfig(options: InitOptions): Promise<ProjectConfig> {
  const questions: prompts.PromptObject[] = [];

  // Project name
  if (!options.name) {
    questions.push({
      type: 'text',
      name: 'name',
      message: 'Project name:',
      initial: 'my-api',
      validate: (value: string) => {
        if (!value) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    });
  }

  // Template selection
  if (!options.template) {
    questions.push({
      type: 'select',
      name: 'template',
      message: 'Select a template:',
      choices: [
        {
          title: 'Minimal',
          value: 'minimal',
          description: 'Basic setup with core features only',
        },
        {
          title: 'Serverless',
          value: 'serverless',
          description: 'Optimized for serverless/edge deployment',
        },
        {
          title: 'Full-Stack',
          value: 'full-stack',
          description: 'Complete setup with auth, email, and caching',
        },
      ],
      initial: 0,
    });
  }

  // Package manager
  if (!options.packageManager) {
    questions.push({
      type: 'select',
      name: 'packageManager',
      message: 'Package manager:',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'pnpm', value: 'pnpm' },
      ],
      initial: 0,
    });
  }

  const answers = await prompts(questions, {
    onCancel: () => {
      throw new CLIError('Operation cancelled');
    },
  });

  return {
    name: options.name || answers.name,
    template: options.template || answers.template,
    packageManager: options.packageManager || answers.packageManager,
    directory: path.resolve(process.cwd(), options.name || answers.name),
  };
}

/**
 * Check if directory exists and is empty
 */
async function checkDirectory(directory: string): Promise<void> {
  try {
    const stats = await fs.stat(directory);
    if (stats.isDirectory()) {
      const files = await fs.readdir(directory);
      if (files.length > 0) {
        throw new CLIError(
          `Directory ${directory} already exists and is not empty`
        );
      }
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Create project using templates
 */
async function createProjectFromTemplate(config: ProjectConfig): Promise<void> {
  const { directory, name, packageManager, template } = config;

  // Ensure base directory exists
  await fs.mkdir(directory, { recursive: true });

  // Prepare template variables
  const installCmd = packageManager === 'npm' ? 'npm install' : 
                     packageManager === 'yarn' ? 'yarn' : 'pnpm install';
  const runCmd = packageManager === 'npm' ? 'npm run' :
                 packageManager === 'yarn' ? 'yarn' : 'pnpm';

  const variables = {
    PROJECT_NAME: name,
    INSTALL_CMD: installCmd,
    RUN_CMD: runCmd,
  };

  // Copy template files
  await copyTemplate(template, directory, variables);

  // Create empty models directory (not in templates)
  await fs.mkdir(path.join(directory, 'src', 'models'), { recursive: true });
}

/**
 * Install dependencies
 */
async function installDependencies(config: ProjectConfig): Promise<void> {
  const { directory, packageManager } = config;

  await withSpinner('Installing dependencies', async () => {
    const { spawn } = await import('child_process');
    
    return new Promise<void>((resolve, reject) => {
      const child = spawn(packageManager, ['install'], {
        cwd: directory,
        stdio: 'ignore',
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new CLIError(`${packageManager} install failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  });
}

/**
 * Init command handler
 */
async function initCommand(options: InitOptions): Promise<void> {
  info('Initializing new Web Loom API project...\n');

  // Get project configuration
  const config = await promptForConfig(options);

  // Check directory
  await checkDirectory(config.directory);

  // Create project
  await withSpinner('Creating project structure', async () => {
    await createProjectFromTemplate(config);
  });

  // Install dependencies
  if (!options.skipInstall) {
    await installDependencies(config);
  }

  // Success message
  success(`\nProject ${config.name} created successfully!`);
  info(`\nNext steps:`);
  info(`  cd ${config.name}`);
  if (options.skipInstall) {
    info(`  ${config.packageManager} install`);
  }
  info(`  cp .env.example .env`);
  info(`  ${config.packageManager === 'npm' ? 'npm run' : config.packageManager} dev\n`);
}

/**
 * Create init command
 */
export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize a new Web Loom API project')
    .option('-n, --name <name>', 'Project name')
    .option('-t, --template <template>', 'Template to use (minimal, serverless, full-stack)')
    .option('--skip-install', 'Skip dependency installation')
    .option('--package-manager <pm>', 'Package manager to use (npm, yarn, pnpm)')
    .action(wrapCommand(initCommand));
}
