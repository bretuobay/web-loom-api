/**
 * Generates a .dockerignore file content with standard ignores
 * for a Node.js / TypeScript monorepo project.
 */
export function generateDockerignore(): string {
  const entries = [
    '# Dependencies',
    'node_modules',
    '',
    '# Build output',
    'dist',
    '',
    '# Version control',
    '.git',
    '.gitignore',
    '',
    '# Environment files',
    '.env',
    '.env.*',
    '',
    '# Logs',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'pnpm-debug.log*',
    '',
    '# Test & coverage',
    'coverage',
    '.nyc_output',
    '',
    '# Turborepo',
    '.turbo',
    '',
    '# IDE & OS',
    '.vscode',
    '.idea',
    '.DS_Store',
    'Thumbs.db',
    '',
    '# Docker',
    'Dockerfile',
    'docker-compose*.yml',
    '.dockerignore',
    '',
    '# Documentation',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
  ];

  return entries.join('\n') + '\n';
}
