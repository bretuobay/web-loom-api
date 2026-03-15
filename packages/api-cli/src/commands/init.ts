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

/**
 * Project template types
 */
export type TemplateType = 'minimal' | 'serverless' | 'full-stack';

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
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Create project directory structure
 */
async function createDirectoryStructure(config: ProjectConfig): Promise<void> {
  const { directory } = config;

  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.join(directory, 'src'), { recursive: true });
  await fs.mkdir(path.join(directory, 'src', 'models'), { recursive: true });
  await fs.mkdir(path.join(directory, 'src', 'routes'), { recursive: true });
}

/**
 * Generate package.json
 */
async function generatePackageJson(config: ProjectConfig): Promise<void> {
  const { directory, name, template } = config;

  const dependencies: Record<string, string> = {
    '@web-loom/api-core': '^0.1.0',
    '@web-loom/api-shared': '^0.1.0',
    '@web-loom/api-adapter-hono': '^0.1.0',
    '@web-loom/api-adapter-drizzle': '^0.1.0',
    '@web-loom/api-adapter-zod': '^0.1.0',
  };

  if (template === 'full-stack') {
    dependencies['@web-loom/api-adapter-lucia'] = '^0.1.0';
    dependencies['@web-loom/api-adapter-resend'] = '^0.1.0';
    dependencies['@web-loom/api-middleware-auth'] = '^0.1.0';
    dependencies['@web-loom/api-middleware-rate-limit'] = '^0.1.0';
  }

  if (template === 'serverless' || template === 'full-stack') {
    dependencies['@web-loom/api-middleware-cors'] = '^0.1.0';
  }

  const packageJson = {
    name,
    version: '0.1.0',
    description: 'Web Loom API project',
    type: 'module',
    scripts: {
      dev: 'webloom dev',
      build: 'tsc',
      start: 'node dist/index.js',
      'migrate:create': 'webloom migrate create',
      'migrate:up': 'webloom migrate up',
      'migrate:down': 'webloom migrate down',
      seed: 'webloom seed',
      test: 'vitest',
    },
    dependencies,
    devDependencies: {
      '@web-loom/api-cli': '^0.1.0',
      typescript: '^5.9.2',
      vitest: '^2.1.8',
      '@types/node': '^22.10.5',
    },
  };

  await fs.writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Generate webloom.config.ts
 */
async function generateConfig(config: ProjectConfig): Promise<void> {
  const { directory, template } = config;

  let configContent = `import { defineConfig } from '@web-loom/api-core';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/mydb',
    poolSize: 10,
  },
  security: {
    cors: {
      enabled: true,
      origins: ['http://localhost:3000'],
    },
  },
`;

  if (template === 'full-stack') {
    configContent += `  auth: {
    sessionDuration: 7 * 24 * 60 * 60, // 7 days
    providers: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    apiKey: process.env.RESEND_API_KEY,
  },
`;
  }

  configContent += `});
`;

  await fs.writeFile(
    path.join(directory, 'webloom.config.ts'),
    configContent
  );
}

/**
 * Generate .env.example
 */
async function generateEnvExample(config: ProjectConfig): Promise<void> {
  const { directory, template } = config;

  let envContent = `# Database
DATABASE_URL=postgresql://localhost:5432/mydb

# Server
PORT=3000
NODE_ENV=development
`;

  if (template === 'full-stack') {
    envContent += `
# Authentication
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@example.com
`;
  }

  await fs.writeFile(path.join(directory, '.env.example'), envContent);
}

/**
 * Generate tsconfig.json
 */
async function generateTsConfig(config: ProjectConfig): Promise<void> {
  const { directory } = config;

  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeFile(
    path.join(directory, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );
}

/**
 * Generate .gitignore
 */
async function generateGitignore(config: ProjectConfig): Promise<void> {
  const { directory } = config;

  const gitignore = `# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
`;

  await fs.writeFile(path.join(directory, '.gitignore'), gitignore);
}

/**
 * Generate example route
 */
async function generateExampleRoute(config: ProjectConfig): Promise<void> {
  const { directory } = config;

  const routeContent = `import type { RequestContext, NextFunction } from '@web-loom/api-core';

/**
 * GET /health
 * Health check endpoint
 */
export async function GET(ctx: RequestContext, next: NextFunction): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
`;

  await fs.writeFile(
    path.join(directory, 'src', 'routes', 'health.ts'),
    routeContent
  );
}

/**
 * Generate README.md
 */
async function generateReadme(config: ProjectConfig): Promise<void> {
  const { directory, name, packageManager } = config;

  const installCmd = packageManager === 'npm' ? 'npm install' : 
                     packageManager === 'yarn' ? 'yarn' : 'pnpm install';
  const runCmd = packageManager === 'npm' ? 'npm run' :
                 packageManager === 'yarn' ? 'yarn' : 'pnpm';

  const readme = `# ${name}

Web Loom API project

## Getting Started

1. Install dependencies:

\`\`\`bash
${installCmd}
\`\`\`

2. Copy \`.env.example\` to \`.env\` and configure:

\`\`\`bash
cp .env.example .env
\`\`\`

3. Run database migrations:

\`\`\`bash
${runCmd} migrate:up
\`\`\`

4. Start development server:

\`\`\`bash
${runCmd} dev
\`\`\`

## Available Scripts

- \`${runCmd} dev\` - Start development server with hot reload
- \`${runCmd} build\` - Build for production
- \`${runCmd} start\` - Start production server
- \`${runCmd} migrate:create\` - Create a new migration
- \`${runCmd} migrate:up\` - Run pending migrations
- \`${runCmd} migrate:down\` - Rollback last migration
- \`${runCmd} seed\` - Seed database with test data
- \`${runCmd} test\` - Run tests

## Project Structure

\`\`\`
src/
├── models/     # Data models
├── routes/     # API routes
└── index.ts    # Application entry point
\`\`\`

## Documentation

- [Web Loom Documentation](https://webloom.dev/docs)
- [API Reference](https://webloom.dev/api)

## License

MIT
`;

  await fs.writeFile(path.join(directory, 'README.md'), readme);
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
    await createDirectoryStructure(config);
    await generatePackageJson(config);
    await generateConfig(config);
    await generateEnvExample(config);
    await generateTsConfig(config);
    await generateGitignore(config);
    await generateExampleRoute(config);
    await generateReadme(config);
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
